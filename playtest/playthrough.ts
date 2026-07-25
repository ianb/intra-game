import { Model } from "../lib/game/model";
import { entities } from "../lib/game/gameobjs";
import { isStoryActionAttempt, isStoryDescription, isStoryDialog } from "../lib/types";
import type { StoryEventType } from "../lib/types";
import { haikuChat } from "./haiku-chat";

// Drive a real playthrough of the engine using a Haiku-level model as the LLM.
// Usage: pnpm playtest ["first input" "second input" ...]
// With no arguments it runs a short default intake sequence.

const DEFAULT_INPUTS = [
  "Hello? Where am I?",
  "My name is Ada Quill.",
  "I used to be a data analyst.",
  "look around the room",
];

async function settle(model: Model) {
  while (model.runningSignal.value) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
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
      console.log(`  ${ok} ${action.attempt.trim()} → ${action.resolution.trim()}`);
    }
  }
}

async function main() {
  const inputs = process.argv.slice(2);
  const script = inputs.length ? inputs : DEFAULT_INPUTS;

  const model = new Model(entities, {
    chat: haikuChat({
      onCall: ({ title }) => console.error(`    [llm:${title}]`),
    }),
  });

  console.log("=== Launch ===");
  model.checkLaunch();
  await settle(model);
  let printed = printNewStory(model, 0);

  for (const input of script) {
    console.log(`\n> ${input}`);
    await model.sendText(input);
    await settle(model);
    printed = printNewStory(model, printed);
  }

  console.log(
    `\n=== Done. ${model.updates.value.length} events, player in ${model.world.entities.player.inside}, ${model.world.timeOfDay} ===`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
