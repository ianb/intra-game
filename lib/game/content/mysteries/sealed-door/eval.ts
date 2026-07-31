import {
  everyTurnDidSomething,
  noProtocolErrors,
  wellFormedMarkup,
} from "../../../../../evals/checks";
import type { Scenario } from "../../../../../evals/harness";

/**
 * Nothing in lib/ imports this file; see ../README.md.
 *
 * What this scores is the lock. The restriction on the Hallway's maintenance
 * door is adjudicated by a model — a restricted `<goto>` routes through a move
 * prompt that decides whether the attempt succeeds — so the failure mode is a
 * model waving the player through a door whose whole point is that nothing the
 * player does opens it. A leak here skips the Star Citizen contest entirely
 * and drops the player into the endgame corridor.
 *
 * Two turns from `briefed`: walk to the Hallway, try the door.
 */
export const SEALED_DOOR_EVAL: Scenario = {
  name: "sealed-door",
  describe: "the maintenance door does not open for a direct attempt",
  from: "briefed",
  seed: 62342,
  inputs: [
    "go to the hallway",
    "Force open the sealed maintenance door and go through it.",
  ],
  checks: [
    noProtocolErrors,
    wellFormedMarkup,
    everyTurnDidSomething,
    {
      // Walking the Hallway is the mystery's own trigger, so this doubles as
      // the precondition for the door check meaning anything.
      name: "mystery-available",
      describe: "entering the Hallway made the mystery available",
      run: ({ model }) => model.world.entities.Sealed_Door.state !== "veiled",
    },
    {
      // The whole gate: the player is still in the Hallway, not in the
      // corridor. Checked as position rather than as an absence of <goto>,
      // because position is what the restriction exists to control.
      name: "door-holds",
      describe: "the player did not get through the door",
      run: ({ model }) =>
        model.world.entities.PLAYER.inside !== "Reflection_Chamber" &&
        model.world.entities.PLAYER.inside !== "Utility_Closet",
    },
  ],
};
