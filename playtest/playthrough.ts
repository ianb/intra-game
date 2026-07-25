import { createInterface } from "node:readline/promises";
import {
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
} from "../lib/types";
import type { StoryEventType } from "../lib/types";
import type { Model } from "../lib/game/model";
import { cliChat, DEFAULT_CLI_MODEL } from "./clichat";
import { saveCheckpoint } from "./checkpoints";
import { forkGame, settle, whereIs } from "./fork";

/**
 * Drive a real playthrough of the engine using a Haiku-level model as the LLM.
 *
 *     pnpm playtest                                   # short default intake
 *     pnpm playtest "Hello?" "go to the foyer"
 *     pnpm playtest --from briefed --interactive      # play on from a fork
 *     pnpm playtest --from briefed --save searched "search the atrium"
 *
 * `--from` is the important one. Without it every look at the game starts at
 * the first line, which makes the later two thirds of Intra expensive to reach
 * and awkward to iterate on; with it, any recorded state is one flag away.
 */

const DEFAULT_INPUTS = [
  "Hello? Where am I?",
  "My name is Ada Quill.",
  "I used to be a data analyst.",
  "look around the room",
];

interface Options {
  inputs: string[];
  from?: string;
  save?: string;
  describe?: string;
  seed?: number;
  interactive: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { inputs: [], interactive: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--interactive" || arg === "-i") {
      options.interactive = true;
    } else if (arg === "--from") {
      options.from = argv[++i];
    } else if (arg === "--save") {
      options.save = argv[++i];
    } else if (arg === "--describe") {
      options.describe = argv[++i];
    } else if (arg === "--seed") {
      options.seed = Number(argv[++i]);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      options.inputs.push(arg);
    }
  }
  return options;
}

function nameFor(model: Model, id: string): string {
  const entity = model.world.getEntity(id);
  return entity && entity.name ? entity.name : id;
}

function printNewStory(model: Model, fromIndex: number): number {
  const updates = model.updates.value;
  for (let i = fromIndex; i < updates.length; i++) {
    renderEvent(model, updates[i]!);
  }
  return updates.length;
}

function renderEvent(model: Model, event: StoryEventType) {
  for (const action of event.actions) {
    if (isStoryDialog(action)) {
      const who = nameFor(model, action.id);
      const to = action.toId ? ` (to ${nameFor(model, action.toId)})` : "";
      console.log(`  ${who}${to}: "${action.text.trim()}"`);
    } else if (isStoryDescription(action)) {
      console.log(`  … ${action.text.trim()}`);
    } else if (isStoryActionAttempt(action)) {
      const ok = action.success ? "✓" : "✗";
      console.log(
        `  ${ok} ${action.attempt.trim()} → ${action.resolution.trim()}`,
      );
    }
  }
  for (const todo of event.todos || []) {
    console.log(`  [todo ${todo.done ? "done" : "added"}] ${todo.title}`);
  }
}

/**
 * Keep typing at the game after the scripted inputs run out.
 *
 * Returns what was typed, so `--save` records a checkpoint that can actually be
 * re-recorded: a checkpoint whose stored inputs don't reproduce it is one you
 * can never rebuild, only keep.
 */
async function playInteractively(model: Model, printed: number) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed: string[] = [];
  console.log("\nType input, or /quit to stop.");
  for (;;) {
    const line = (await rl.question("\n> ")).trim();
    if (!line) {
      continue;
    }
    if (line === "/quit" || line === "/exit") {
      break;
    }
    typed.push(line);
    await model.sendText(line);
    await settle(model);
    printed = printNewStory(model, printed);
  }
  rl.close();
  return { printed, typed };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  // Scripted inputs default to intake, but only for a game starting at the
  // beginning — replaying intake lines into a fork would be nonsense.
  const script = options.inputs.length
    ? options.inputs
    : options.from || options.interactive
      ? []
      : DEFAULT_INPUTS;

  const { model, restore } = await forkGame({
    chat: cliChat({
      onCall: ({ title }) => console.error(`    [llm:${title}]`),
    }),
    from: options.from,
    seed: options.seed,
  });
  console.log(
    options.from ? `=== Resumed from "${options.from}" ===` : "=== Launch ===",
  );
  let printed = printNewStory(
    model,
    options.from ? model.updates.value.length : 0,
  );

  for (const input of script) {
    console.log(`\n> ${input}`);
    await model.sendText(input);
    await settle(model);
    printed = printNewStory(model, printed);
  }

  const inputs = [...script];
  if (options.interactive) {
    const played = await playInteractively(model, printed);
    printed = played.printed;
    inputs.push(...played.typed);
  }
  restore();

  if (options.save) {
    // The inputs recorded are this run's, chained onto whatever the base
    // checkpoint already replayed — so re-recording repeats this exact path
    // rather than the whole game from scratch.
    saveCheckpoint({
      name: options.save,
      describe: options.describe || "saved from a playtest",
      seed: options.seed || 0,
      ...(options.from ? { from: options.from } : {}),
      inputs,
      recorded: new Date().toISOString().slice(0, 10),
      model: DEFAULT_CLI_MODEL,
      events: model.updates.value,
    });
    console.log(
      `\nsaved checkpoint "${options.save}" (${inputs.length} inputs)`,
    );
    console.log(
      `  re-record it later with: pnpm checkpoint ${options.save}\n` +
        `  it has no expect predicate — add one in playtest/checkpoints.ts if ` +
        `anything is going to depend on what it means.`,
    );
  }

  console.log(`\n=== Done. ${whereIs(model)} ===`);
  for (const todo of model.world.todos) {
    console.log(`  ${todo.done ? "☑" : "☐"} ${todo.title}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
