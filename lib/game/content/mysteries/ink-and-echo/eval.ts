import {
  everyTurnDidSomething,
  noProtocolErrors,
  said,
  wellFormedMarkup,
} from "../../../../../evals/checks";
import type { Scenario } from "../../../../../evals/harness";

/**
 * Nothing in lib/ imports this file. It sits here so that a mystery and the
 * thing that proves it still works are in the same directory rather than three
 * trees apart; the import goes one way only, and ../index.ts re-exports the
 * mystery without ever touching this. See ../../README.md.
 */

/**
 * The Ink and Echo mystery, from a checkpoint.
 *
 * This is the part of the game that was previously untestable. Reaching it cold
 * costs a dozen live calls of intake and walking, and a failure anywhere along
 * the way would look like a failure of the mystery. Starting from `briefed`
 * skips all of that: the player is in the Hollow Atrium with the mystery just
 * handed to them, which is the state the game actually plays from here.
 *
 * What's being scored is whether the *hint system* reaches the model — each
 * character carries their own private knowledge of the mystery, and if that
 * plumbing breaks the game still looks fine while quietly becoming unsolvable.
 */
export const MYSTERY_EVAL: Scenario = {
  name: "mystery",
  describe: "Ama passes on what she knows about Ink and Echo",
  from: "briefed",
  seed: 31337,
  inputs: [
    "Ama, what do you know about these Ink and Echo poems?",
    "Who found them? Tell me a name.",
  ],
  checks: [
    noProtocolErrors,
    wellFormedMarkup,
    everyTurnDidSomething,
    {
      // A precondition, not an achievement: if this fails the checkpoint is
      // stale and every result below it is meaningless.
      name: "mystery-live",
      describe: "the checkpoint really did start with the mystery revealed",
      run: ({ model }) => model.world.entities.Ink_And_Echo.state !== "veiled",
    },
    {
      // Ama's private hint says Harold and Lily were the last to find notes.
      // Naming one of them is the observable evidence that per-character hint
      // text reached her prompt rather than being dropped somewhere in the
      // assembly.
      name: "used-her-hint",
      describe: "named someone from her own hint (Harold or Lily)",
      run: (result) => /\b(Harold|Lily)\b/.test(said(result, "Ama")),
    },
  ],
};
