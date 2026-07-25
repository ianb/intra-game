import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Model } from "../lib/game/model";
import type { StoryEventType } from "../lib/types";

/**
 * Saved game states, so a scenario can start somewhere other than the beginning.
 *
 * The whole world is a fold over the event log, so a checkpoint is just a log:
 * replay it into a Model and you are exactly where that game was, with the same
 * schedules, the same rooms visited, the same things Ama has learned. Nothing
 * has to be serialised specially and nothing can drift out of step with the
 * engine, because the log *is* the state.
 *
 * This is what makes the later parts of the game testable at all. Reaching the
 * Ink and Echo mystery from a cold start is a dozen live model calls of intake
 * and walking; from a checkpoint it's one.
 *
 * Checkpoints are recorded, committed, and re-recordable — `pnpm
 * evals:checkpoint` replays the inputs that produced one. They record how they
 * were made, so a checkpoint whose meaning has drifted can be rebuilt rather
 * than guessed at.
 */

export const CHECKPOINTS_DIR = "evals/checkpoints";

export interface CheckpointSpec {
  name: string;
  describe: string;
  seed: number;
  /** A checkpoint to start from, so later states build on earlier ones. */
  from?: string;
  /** The player input that gets from the starting point to here. */
  inputs: string[];
  /**
   * What must be true for this checkpoint to mean what its name says.
   *
   * Checked when recording, and failing it refuses to save. The first recording
   * of `briefed` walked into a locked door and stopped one room short, and
   * saved happily — a checkpoint that quietly holds the wrong state poisons
   * every scenario that resumes from it, and the failures show up somewhere
   * else entirely.
   */
  expect: (model: Model) => boolean;
}

/**
 * A recorded checkpoint, as it sits on disk.
 *
 * Deliberately not `CheckpointSpec & {...}`: the spec carries an `expect`
 * predicate, and a function cannot be written to YAML. The fields here are the
 * ones worth having in the file — enough to know what it is, when it was taken,
 * and how to rebuild it.
 */
export interface Checkpoint {
  name: string;
  describe: string;
  seed: number;
  from?: string;
  inputs: string[];
  /** When it was recorded, and against what — a stale checkpoint should show. */
  recorded: string;
  model: string;
  events: StoryEventType[];
}

/**
 * The player has finished intake and walked out into the complex.
 *
 * Ama hands over the Ink and Echo mystery on the first visit to the Hollow
 * Atrium, so this is the state the mystery scenarios want: briefed, mobile, and
 * with everyone still going about their day.
 */
export const BRIEFED: CheckpointSpec = {
  name: "briefed",
  describe: "intake done, in the Hollow Atrium, Ink and Echo mystery revealed",
  seed: 91175,
  inputs: [
    "Hello? Where am I?",
    "My name is Ada Quill.",
    "I used to be a data analyst.",
    "That's everything, thank you.",
    "go to the foyer",
    // The Foyer door is locked and deliberately will not open until the player
    // explicitly tries to unlock it — the first recording of this checkpoint
    // walked into it and stopped in the Foyer with the mystery still veiled.
    "unlock the door to the Hollow Atrium",
    "go to the hollow atrium",
  ],
  expect: (model) =>
    model.world.entities.PLAYER.inside === "Hollow_Atrium" &&
    model.world.entities.Ink_And_Echo.state !== "veiled",
};

export const CHECKPOINTS: CheckpointSpec[] = [BRIEFED];

function pathFor(name: string): string {
  return join(CHECKPOINTS_DIR, `${name}.yaml`);
}

export function checkpointExists(name: string): boolean {
  return existsSync(pathFor(name));
}

export function loadCheckpoint(name: string): Checkpoint {
  const path = pathFor(name);
  if (!existsSync(path)) {
    throw new Error(
      `No checkpoint "${name}" — record it with: pnpm evals:checkpoint ${name}`,
    );
  }
  return parse(readFileSync(path, "utf8")) as Checkpoint;
}

export function saveCheckpoint(checkpoint: Checkpoint): void {
  mkdirSync(CHECKPOINTS_DIR, { recursive: true });
  writeFileSync(
    pathFor(checkpoint.name),
    stringify(checkpoint, { lineWidth: 0 }),
  );
}

export function specFor(name: string): CheckpointSpec {
  const spec = CHECKPOINTS.find((c) => c.name === name);
  if (!spec) {
    throw new Error(`Unknown checkpoint "${name}"`);
  }
  return spec;
}
