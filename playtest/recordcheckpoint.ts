import { cliChat, DEFAULT_CLI_MODEL } from "./clichat";
import {
  CHECKPOINTS,
  checkpointExists,
  listCheckpoints,
  recipeFor,
  saveCheckpoint,
  specFor,
  type CheckpointSpec,
} from "./checkpoints";
import { forkGame, settle, whereIs } from "./fork";

/**
 * Record and re-record checkpoints.
 *
 *     pnpm checkpoint                  # any checkpoint not yet recorded
 *     pnpm checkpoint --list           # what's on disk, and how it got there
 *     pnpm checkpoint briefed          # re-record one
 *     pnpm checkpoint --force          # re-record all
 *
 * To *make* a new one, play to where you want it and save from there:
 *
 *     pnpm playtest --from briefed --save searched "search the atrium"
 *
 * These are live model calls — that's the point. A checkpoint reached by a
 * scripted fake would be a state no real game ever passes through, and anything
 * resuming from it would be exercising a fiction.
 */

async function record(spec: CheckpointSpec, modelId: string): Promise<void> {
  console.log(`\n=== ${spec.name} — ${spec.describe} ===`);
  if (spec.from) {
    console.log(`  resuming from "${spec.from}"`);
  }
  const { model, restore } = await forkGame({
    chat: cliChat({ model: modelId }),
    from: spec.from,
    seed: spec.seed,
  });

  for (const input of spec.inputs) {
    console.log(`  > ${input}`);
    await model.sendText(input);
    await settle(model);
  }
  restore();

  if (!spec.expect(model)) {
    throw new Error(
      `Checkpoint "${spec.name}" did not reach the state it describes ` +
        `(${spec.describe}).\n  ended: ${whereIs(model)}\n` +
        `  Nothing was saved. Either the inputs no longer get there, or the ` +
        `game changed under them.`,
    );
  }
  saveCheckpoint({
    name: spec.name,
    describe: spec.describe,
    seed: spec.seed,
    ...(spec.from ? { from: spec.from } : {}),
    inputs: spec.inputs,
    recorded: new Date().toISOString().slice(0, 10),
    model: modelId,
    events: model.updates.value,
  });
  console.log(`  saved — ${whereIs(model)}`);
}

function list(): void {
  const checkpoints = listCheckpoints();
  if (!checkpoints.length) {
    console.log("No checkpoints recorded yet.");
    return;
  }
  for (const checkpoint of checkpoints) {
    const chain = checkpoint.from ? ` (from ${checkpoint.from})` : "";
    const checked = specFor(checkpoint.name) ? "" : " [no expect predicate]";
    console.log(
      `${checkpoint.name}${chain} — ${checkpoint.describe}\n` +
        `  ${checkpoint.events.length} events, recorded ${checkpoint.recorded} ` +
        `against ${checkpoint.model}${checked}\n` +
        checkpoint.inputs.map((input) => `    > ${input}`).join("\n"),
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    list();
    return;
  }
  const force = args.includes("--force");
  const named = args.filter((a) => !a.startsWith("--"));
  const modelArg = args.indexOf("--model");
  const modelId =
    modelArg === -1
      ? DEFAULT_CLI_MODEL
      : (args[modelArg + 1] ?? DEFAULT_CLI_MODEL);

  // A named checkpoint may exist only on disk (saved from a playtest), so go
  // through recipeFor rather than requiring a matching entry in CHECKPOINTS.
  const specs = named.length
    ? named.map(recipeFor)
    : force
      ? listCheckpoints().map((checkpoint) => recipeFor(checkpoint.name))
      : CHECKPOINTS.filter((spec) => !checkpointExists(spec.name));
  if (!specs.length) {
    console.log("Every checkpoint is already recorded; --force to redo them.");
    return;
  }
  for (const spec of specs) {
    // In declaration order, because a checkpoint that resumes from another
    // needs that one on disk first.
    await record(spec, modelId);
  }
}

await main();
