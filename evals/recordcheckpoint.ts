import { entities } from "../lib/game/content";
import { Model } from "../lib/game/model";
import { cliChat } from "../playtest/clichat";
import { installSeededRandom } from "../playtest/seed";
import {
  CHECKPOINTS,
  checkpointExists,
  loadCheckpoint,
  saveCheckpoint,
  specFor,
  type CheckpointSpec,
} from "./checkpoints";

/**
 * Record the checkpoints scenarios start from.
 *
 *     pnpm evals:checkpoint            # any checkpoint not yet recorded
 *     pnpm evals:checkpoint briefed    # re-record one
 *     pnpm evals:checkpoint --force    # re-record all
 *
 * These are live model calls — that's the point. A checkpoint reached by a
 * scripted fake would be a state no real game ever passes through, and a
 * scenario resuming from it would be testing a fiction.
 */

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

async function settle(model: Model): Promise<void> {
  while (model.runningSignal.value) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function record(spec: CheckpointSpec, modelId: string): Promise<void> {
  console.log(`\n=== ${spec.name} — ${spec.describe} ===`);
  const restore = installSeededRandom(spec.seed);
  const model = new Model(entities, { chat: cliChat({ model: modelId }) });

  if (spec.from) {
    console.log(`  resuming from "${spec.from}"`);
    model.replaceLog(loadCheckpoint(spec.from).events);
  } else {
    model.checkLaunch();
  }
  await settle(model);

  for (const input of spec.inputs) {
    console.log(`  > ${input}`);
    await model.sendText(input);
    await settle(model);
  }
  restore();

  const player = model.world.entities.PLAYER;
  const where =
    `${player.name} in ${player.inside}, ` +
    `Ink_And_Echo ${model.world.entities.Ink_And_Echo.state}`;
  if (!spec.expect(model)) {
    throw new Error(
      `Checkpoint "${spec.name}" did not reach the state it describes ` +
        `(${spec.describe}).\n  ended: ${where}\n` +
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
  console.log(`  saved ${model.updates.value.length} events — ${where}`);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const named = args.filter((a) => !a.startsWith("--"));
  const modelArg = args.indexOf("--model");
  const modelId =
    modelArg === -1 ? DEFAULT_MODEL : (args[modelArg + 1] ?? DEFAULT_MODEL);

  const specs = named.length
    ? named.map(specFor)
    : CHECKPOINTS.filter((c) => force || !checkpointExists(c.name));
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
