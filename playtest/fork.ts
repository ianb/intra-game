import { entities } from "../lib/game/content";
import { Model, type ChatFn } from "../lib/game/model";
import { loadCheckpoint } from "./checkpoints";
import { installSeededRandom } from "./seed";

/**
 * Starting a game somewhere other than the beginning.
 *
 * Shared by everything that drives the engine outside the browser — the
 * playtest CLI, the checkpoint recorder, the eval harness — so "start from
 * `briefed`" means precisely the same thing in all three, and a fork is one
 * flag rather than a paragraph of setup.
 */

export async function settle(model: Model): Promise<void> {
  while (model.runningSignal.value) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export interface ForkOptions {
  chat: ChatFn;
  /** A checkpoint name; omitted starts a new game at the game's first line. */
  from?: string;
  /** Seeds Math.random, so schedules and dice rolls reproduce. */
  seed?: number;
}

/**
 * A Model sitting at the requested starting point, settled and ready for input.
 *
 * `restore` puts Math.random back; call it once the run is over so a seeded
 * fork doesn't leak determinism into whatever runs next in the process.
 *
 * Forking with a different seed than the checkpoint was recorded with is fine
 * and often what you want: the schedule for the day is baked into the log's
 * launch event, so it replays identically either way, and the seed only steers
 * the dice from the fork point on.
 */
export async function forkGame(
  options: ForkOptions,
): Promise<{ model: Model; restore: () => void }> {
  const restore = options.seed
    ? installSeededRandom(options.seed)
    : () => undefined;
  const model = new Model(entities, { chat: options.chat });
  if (options.from) {
    model.replaceLog(loadCheckpoint(options.from).events);
  } else {
    model.checkLaunch();
  }
  await settle(model);
  return { model, restore };
}

/** Where a run ended up, for the one-line summary these tools all print. */
export function whereIs(model: Model): string {
  const player = model.world.entities.PLAYER;
  const open = model.world.todos.filter((todo) => !todo.done).length;
  return (
    `${player.name} in ${player.inside} at ${model.world.timeOfDay}, ` +
    `${model.updates.value.length} events, ${open} open tasks`
  );
}
