import { INTAKE_EVAL } from "../evals/scenarios";

// Shared scenario definitions so the recorder and the replay tests agree on the
// exact seed + input sequence. Change any of these and you must re-record the
// cassette (pnpm playtest:record).
export interface Scenario {
  name: string;
  seed: number;
  cassette: string;
  inputs: string[];
}

/**
 * The inputs come from the eval that replays this cassette, not from here.
 *
 * They were duplicated, and the copies drifted the moment the eval's intake
 * inputs changed: a cassette recorded against one set of turns, replayed
 * against another, misses on the first prompt and reports as a stale cassette.
 * The staleness message is accurate but points at the wrong cause, which is a
 * bad half-hour waiting to happen.
 */
export const INTAKE: Scenario = {
  name: "intake",
  seed: INTAKE_EVAL.seed,
  cassette: "playtest/cassettes/intake.json",
  inputs: INTAKE_EVAL.inputs,
};

export const SCENARIOS: Scenario[] = [INTAKE];
