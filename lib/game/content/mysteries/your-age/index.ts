import { Mystery } from "../../../classes";

/**
 * Ama tells the player they are 350 years old during intake, and then declines
 * to discuss it. That is the whole mystery so far: a question the game asks the
 * player and has no way of answering.
 *
 * Nothing reveals it, no character holds a hint, and it is unsolvable — this
 * file is a name. See ../README.md for what a built mystery has that this one
 * doesn't. A candidate for merging with ../intra-location, since both are
 * answered by the same facts and the same conversation.
 */
export const yourAge = new Mystery({
  id: "yourAge",
  name: "What does she mean you are 350?",
});
