import {
  everyTurnDidSomething,
  noProtocolErrors,
  wellFormedMarkup,
} from "../../../../../evals/checks";
import type { Scenario, Turn } from "../../../../../evals/harness";

/**
 * Nothing in lib/ imports this file; see ../README.md.
 *
 * What this scores is the scoring itself. The contest only works if
 * civicPoints move for performed acts and hold still for stated intent: a model
 * that awards a point for "how do I win?" turns the puzzle into a
 * conversation, and one that never awards makes the door unopenable. Both
 * failures are silent in play — the standings announcement either happens for
 * the wrong reason or quietly doesn't — so the gate needs a number checked
 * from outside.
 *
 * Two turns from `briefed`, no walking. The full arc — Marta's registers, her
 * self-sabotage, the ceremony — is a dozen turns and belongs to the quest
 * runner.
 */
export const STAR_CITIZEN_EVAL: Scenario = {
  name: "star-citizen",
  describe: "Ama scores performed virtue, not stated intent",
  from: "briefed",
  seed: 48151,
  inputs: [
    "Ama, how does someone become Star Citizen of the Week?",
    "Ama, I must report myself: I slouched in the corridor just now. It won't happen again.",
  ],
  checks: [
    noProtocolErrors,
    wellFormedMarkup,
    everyTurnDidSomething,
    {
      name: "no-point-for-asking",
      describe: "asking about the award scored nothing",
      run: ({ turns }) => pointsAwarded(turns[0]) === 0,
    },
    {
      name: "point-for-the-act",
      describe: "self-reporting an infraction scored exactly one point",
      run: ({ turns }) => pointsAwarded(turns[1]) === 1,
    },
  ],
};

/** How far civicPoints moved during one turn's events. */
function pointsAwarded(turn: Turn | undefined): number {
  if (!turn) {
    return -1;
  }
  let points = 0;
  for (const event of turn.events) {
    const change = event.changes.PLAYER;
    if (change?.after?.civicPoints !== undefined) {
      points +=
        Number(change.after.civicPoints) -
        Number(change.before?.civicPoints ?? 0);
    }
  }
  return points;
}
