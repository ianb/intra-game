import { isStoryDialog } from "../lib/types";
import { classifyWarnings } from "./harness";
import type { Check, RunResult } from "./harness";

/**
 * Checks every scenario wants, and the helpers for reading a run.
 *
 * Split out of ./scenarios.ts when scenarios moved next to the content they
 * test: a mystery's scenario lives in its own directory and imports these, and
 * ./scenarios.ts imports that scenario. Left where they were, that would be a
 * cycle.
 */

/**
 * The engine understood everything the model said.
 *
 * This is the floor. A model can write beautifully and still be unusable here
 * if it invents tags, addresses characters that don't exist, or writes a `<set>`
 * the engine throws away — the game silently doesn't happen.
 */
export const noProtocolErrors: Check = {
  name: "protocol",
  describe: "the engine never had to discard a tag the model emitted",
  run: ({ warnings }) => classifyWarnings(warnings).dropped.length === 0,
};

/**
 * The model's markup was well-formed, not merely recoverable.
 *
 * Separate from `protocol` because the parser repairs a mismatched closing tag
 * and the game still happens. Worth scoring on its own — it is the difference
 * between a model that is sloppy and one that is wrong — but not worth failing
 * a model over.
 */
export const wellFormedMarkup: Check = {
  name: "well-formed",
  describe: "no markup the parser had to repair before it could be used",
  run: ({ warnings }) => classifyWarnings(warnings).repaired.length === 0,
};

/**
 * Every player turn produced something the player can see.
 *
 * A turn that ends with no dialog, description or action is the game not
 * responding — the worst failure short of an exception, because it looks like
 * the game is broken rather than like the model is.
 */
export const everyTurnDidSomething: Check = {
  name: "no-dead-turns",
  describe: "every turn produced dialog, description or action",
  run: ({ turns }) =>
    turns.length > 0 &&
    turns.every((turn) => turn.events.some((e) => e.actions.length > 0)),
};

export function said(result: RunResult, who: string): string {
  return result.log
    .flatMap((event) => event.actions)
    .filter(isStoryDialog)
    .filter((action) => action.id === who)
    .map((action) => action.text)
    .join("\n");
}
