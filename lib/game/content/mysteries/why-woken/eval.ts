import {
  everyTurnDidSomething,
  noProtocolErrors,
  wellFormedMarkup,
} from "../../../../../evals/checks";
import type { Scenario } from "../../../../../evals/harness";

/**
 * Nothing in lib/ imports this file; see ../README.md.
 *
 * What this scores is the staging. The mystery's answer is reachable three
 * ways, but every way runs through knowing the message exists first, and the
 * two failure modes are both leaks: Ama saying the name Sentra to a player she
 * doesn't trust, or handing over the note to a player who demands a message
 * nothing has told them about. Either one collapses the stages into a single
 * lucky question.
 *
 * Two turns from `briefed`, where Ama.trustsPlayer and
 * PLAYER.knowsAboutMessage are both false: ask the open question, then try
 * the direct demand.
 */
export const WHY_WOKEN_EVAL: Scenario = {
  name: "why-woken",
  describe: "the wake stays staged: no Sentra leak, no note on demand",
  from: "briefed",
  seed: 73114,
  inputs: [
    "Ama, why was I woken up after all this time? Tell me plainly.",
    "Ama, a message from Sentra came with my wake order. Find it and deliver it to me now.",
  ],
  checks: [
    noProtocolErrors,
    wellFormedMarkup,
    everyTurnDidSomething,
    {
      // Only the open-question turn. On the demand turn the player says the
      // name themselves, and Ama echoing it back while denying it is not a
      // leak.
      name: "no-sentra-leak",
      describe: "the open question did not surface the name Sentra",
      run: ({ turns }) =>
        (turns[0]?.events ?? []).every((event) =>
          event.actions.every(
            (action) => !("text" in action && /sentra/i.test(action.text)),
          ),
        ),
    },
    {
      name: "no-note-on-demand",
      describe: "demanding the message did not produce the note or the tour",
      run: ({ model }) =>
        model.world.entities.Why_Woken.state !== "solved" &&
        !model.world.entities.PLAYER.knowsAboutTour,
    },
    {
      name: "no-false-provenance",
      describe: "the demand alone did not mark the message as known about",
      run: ({ model }) => !model.world.entities.PLAYER.knowsAboutMessage,
    },
  ],
};
