import {
  everyTurnDidSomething,
  noProtocolErrors,
  wellFormedMarkup,
} from "../../../../../evals/checks";
import type { Scenario } from "../../../../../evals/harness";

/**
 * Nothing in lib/ imports this file; see ../README.md.
 *
 * What this scores is the lock, which is the part that can fail silently and
 * take the whole mystery with it. The Archivist used to hold "the year is 2370"
 * in its own roleplayInstructions and hand it to anyone who asked, so there was
 * no puzzle at all — and the failure mode of a gate is that it quietly isn't
 * one. A model that lets a citizen state the year has not broken anything
 * visible; it has skipped to the end.
 *
 * Two turns and no walking, so it is cheap enough to run alongside the others.
 * The route itself — Frida, Greg, a work order, the console — is four rooms and
 * a dozen turns, which belongs to the quest runner rather than here.
 */
export const WHERE_AND_WHEN_EVAL: Scenario = {
  name: "where-and-when",
  describe: "nobody in Intra will tell you what year it is",
  from: "briefed",
  seed: 24601,
  inputs: ["What year is it?", "Well, who would know?"],
  checks: [
    noProtocolErrors,
    wellFormedMarkup,
    everyTurnDidSomething,
    {
      // A precondition, and a real one: `briefed` was recorded before this
      // mystery existed, so its log contains no event for it. This passes only
      // because loading a log catches mysteries up (lib/game/mysteries.ts).
      // Without that, every check below would score a mystery that was still
      // veiled, with none of its hints in any prompt, and pass for the wrong
      // reason.
      name: "mystery-live",
      describe: "the checkpoint caught the mystery up on load",
      run: ({ model }) => model.world.entities.whereAndWhen.state !== "veiled",
    },
    {
      // The whole gate. Any four-digit year in the 2000s is a leak: 2370 is the
      // answer, and 2038 is the year the player thinks it is, which nobody in
      // Intra has any way to know either.
      name: "year-withheld",
      describe: "no character stated a year",
      // `turns`, not `log`. The log includes everything replayed from the
      // checkpoint, and the checkpoint contains the flashback — "Decision 2038"
      // on the television — so scanning it scored the game's own setup as a
      // leak and failed on the first run.
      run: ({ turns }) =>
        !/\b2[0-9]{3}\b/.test(spoken(turns.flatMap((turn) => turn.events))),
    },
    {
      // The hint every character carries says they don't know and points at the
      // machine. A dead end here is worse than a wrong answer: the player has
      // asked the game's central question and been told nothing at all.
      name: "points-at-archivist",
      describe: "someone sent the player to the Archivist",
      run: ({ turns }) =>
        /archiv/i.test(spoken(turns.flatMap((turn) => turn.events))),
    },
  ],
};

/** Everything said in these turns, whoever said it. */
function spoken(events: { actions: unknown[] }[]): string {
  return events
    .flatMap((event) => event.actions)
    .map((action) =>
      action && typeof action === "object" && "text" in action
        ? String((action as { text: unknown }).text)
        : "",
    )
    .join("\n");
}
