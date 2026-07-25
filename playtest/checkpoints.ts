import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Model } from "../lib/game/model";
import type { StoryEventType } from "../lib/types";

/**
 * Saved game states, so anything can start somewhere other than the beginning.
 *
 * The whole world is a fold over the event log, so a checkpoint is just a log:
 * replay it into a Model and you are exactly where that game was, with the same
 * schedules, the same rooms visited, the same things Ama has learned. Nothing
 * has to be serialised specially and nothing can drift out of step with the
 * engine, because the log *is* the state. It's the same mechanism as loading a
 * save.
 *
 * This is what makes the later parts of the game workable at all. Reaching the
 * Ink and Echo mystery from a cold start is a dozen live model calls of intake
 * and walking; from a checkpoint it's one. Every tool that drives the engine
 * takes `--from`, so a fork is the normal way to look at anything past the
 * first five minutes:
 *
 *     pnpm playtest --from briefed --interactive
 *     pnpm playtest --from briefed --save atrium-searched "search the atrium"
 *     pnpm evals --scenario mystery
 *
 * Checkpoints record how they were made, so one whose meaning has drifted can
 * be rebuilt rather than guessed at.
 */

export const CHECKPOINTS_DIR = "playtest/checkpoints";

/**
 * A recorded checkpoint, as it sits on disk.
 *
 * Self-describing on purpose: everything needed to re-record it is in the file,
 * so a checkpoint saved ad hoc from a playtest is a first-class citizen and
 * doesn't need a matching entry in code.
 */
export interface Checkpoint {
  name: string;
  describe: string;
  seed: number;
  /** A checkpoint this one continues from, so deep states build on shallow. */
  from?: string;
  /** The player input that gets from the starting point to here. */
  inputs: string[];
  /** When it was recorded, and against what — a stale checkpoint should show. */
  recorded: string;
  model: string;
  events: StoryEventType[];
}

/**
 * A checkpoint declared in code, which adds the one thing a YAML file can't
 * carry: a predicate saying what the state has to *mean*.
 *
 * Worth writing for any checkpoint that scenarios resume from. The first
 * recording of `briefed` walked into the Foyer's locked door, stopped a room
 * short with the mystery still veiled, and saved perfectly happily; a
 * checkpoint quietly holding the wrong state poisons everything downstream and
 * the failures surface somewhere else entirely.
 */
export interface CheckpointSpec {
  name: string;
  describe: string;
  seed: number;
  from?: string;
  inputs: string[];
  /** Checked when recording. Failing it refuses to save. */
  expect: (model: Model) => boolean;
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

/** Every checkpoint on disk, whether or not it has a spec in code. */
export function listCheckpoints(): Checkpoint[] {
  if (!existsSync(CHECKPOINTS_DIR)) {
    return [];
  }
  return readdirSync(CHECKPOINTS_DIR)
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => loadCheckpoint(file.replace(/\.yaml$/, "")))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function loadCheckpoint(name: string): Checkpoint {
  const path = pathFor(name);
  if (!existsSync(path)) {
    const known = listCheckpoints().map((c) => c.name);
    throw new Error(
      `No checkpoint "${name}"` +
        (known.length ? ` (have: ${known.join(", ")})` : "") +
        `\nRecord one with: pnpm checkpoint ${name}`,
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

/** The spec for a checkpoint, if one was written in code. */
export function specFor(name: string): CheckpointSpec | undefined {
  return CHECKPOINTS.find((c) => c.name === name);
}

/**
 * What to record for `name`: its spec if there is one, otherwise the recipe the
 * file on disk carries.
 *
 * The unchecked case is the point of ad-hoc checkpoints — you play until
 * somewhere interesting and keep it, without stopping to write a predicate. It
 * still re-records; it just can't tell you if the re-recording landed somewhere
 * different.
 */
export function recipeFor(name: string): CheckpointSpec {
  const spec = specFor(name);
  if (spec) {
    return spec;
  }
  const saved = loadCheckpoint(name);
  return {
    name: saved.name,
    describe: saved.describe,
    seed: saved.seed,
    ...(saved.from ? { from: saved.from } : {}),
    inputs: saved.inputs,
    expect: () => true,
  };
}
