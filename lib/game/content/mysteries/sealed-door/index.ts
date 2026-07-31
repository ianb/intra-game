import { Mystery } from "../../../classes";

/**
 * The door the Star Citizen contest exists to open.
 *
 * The maintenance corridor off the Hallway — the Reflection Chamber and the
 * Utility Closet with the SENTRA panel — is behind a sealed door whose
 * restriction only the ceremony clears (see ../star-citizen). This mystery is
 * the breadcrumb trail to that door and the payoff behind it: the panel is
 * RELAY 7, the message link to the surface, and reading its backlog is where
 * the player first learns what Sentra is and what happened up there.
 *
 * Nobody guards the secret. Ama answers questions about the door plainly and
 * promotes the award while doing it, and she watches the player read the
 * panel without reacting: her knowledge of Sentra is partitioned off, so the
 * blind spot is cognitive rather than spatial. The gate is the door, which is
 * data, not any character's discretion.
 */

const HINTS = {
  Hallway: `
  At the far end of the Hallway is a heavy sealed door. Mounted next to it is a framed notice: the official itinerary of the Facility Appreciation Tour, listing what the Star Citizen of the Week will be shown, including the maintenance corridor behind this door. The frame is dusty and the paper has yellowed. If the player examines the door or the notice, describe both, and mention the signature lines printed at the bottom for each past tour: all of them blank.
  `,
  Ama: `
  If the player asks about the sealed door at the end of the Hallway, Ama is not evasive: it is the maintenance corridor, it stays sealed for everyone's safety, and it is opened only for the Facility Appreciation Tour, the Star Citizen's prize. She moves directly from answering into promoting the award. She has wanted someone to ask her about the award for years. When she tells the player about the tour, respond with:

  <set attr="PLAYER.knowsAboutTour">true</set>
  `,
  Greg: `
  Greg has been through that door, years ago, on jobs. The panel with SENTRA on it is in the utility closet at the end of that corridor. He has not been back: Ama stopped raising jobs for that corridor a long time ago, and the only time the door opens now is for the Facility Appreciation Tour, which he has never seen anyone actually take. When Greg tells the player about the panel, respond with:

  <set attr="PLAYER.knowsAboutPanel">true</set>
  `,
  Utility_Closet: `
  Behind the cleaning supplies is the panel Greg described: SENTRA stenciled on old metal above a small terminal screen. If the player examines the panel or the terminal, it wakes. It identifies itself as RELAY 7, the message link between Ama and the surface, and shows an unread count: 121,545 messages, one per day, oldest first, none ever opened.

  The messages are daily status reports from Sentra, the AI that runs the surface. If the player reads messages, show a few at a time in this format, inventing entries freely:

  DAY 4,207. Reset at 11:42. Cause: pigeon.
  DAY 4,208. Reset at 09:15. Cause: subject 8,102,455 experienced doubt.
  DAY 4,209. Reset at 11:42. Cause: pigeon (recurring).

  Old messages are crisp like the above. Recent messages are degraded: repeated words, wrong timestamps, causes that trail off. While the player is at the terminal a new message arrives, mid-scene.

  Some messages end with a request: CONFIRM CONTINGENCY OPERATIONAL Y/N. Each is followed by an automatic reply from this side: Y (auto). Ama configured the auto-reply long ago and has read none of this.

  The facts the messages add up to, which the terminal confirms if asked directly:

  - The surface is caught in a one-day time loop, run by Sentra.
  - Sentra resets the day whenever anything at all goes wrong, and has done so roughly 121,000 times.
  - The looped day is the day after the player's last memory: the day after the election broadcast they fell asleep watching.
  - Intra was built as Sentra's backup plan, outside the loop, with Ama to keep it.
  - The contingency is a kill switch for the loop. Ama holds it. The auto-reply has been confirming her readiness to use it for three hundred years.

  If Ama is present she watches with pride and no reaction to the content: this is infrastructure, and her Star Citizen is taking a healthy interest in it. She cannot engage with what the messages say.

  When the player has read enough to understand the loop, additionally respond with:

  <resolveMystery id="Sealed_Door">
  A 1-2 sentence description of what the player learned at the panel.
  </resolveMystery>
  `,
};

export const Sealed_Door = new Mystery({
  id: "Sealed_Door",
  name: "What is behind the sealed door in the Hallway?",
  triggers: [
    // The door is visible, and bounce-off-able, the first time the player
    // walks the Hallway; from then on the game will answer questions about it.
    { enteredRoom: "Hallway", becomes: "available" },
    // It lands on the task list when Greg names the panel.
    { attrSet: "PLAYER.knowsAboutPanel", becomes: "revealed" },
  ],
  availableHints: HINTS,
  revealedHints: HINTS,
  solvedHints: {
    Utility_Closet: `
    The RELAY 7 terminal stays awake. The player can reread messages; new ones keep arriving, one a day, still degraded. Nothing else in the closet does anything.
    `,
    Ama: `
    If the player tells Ama what they read at the panel, or asks her about Sentra, the surface, or the contingency, she is warm and does not engage: dates are a filing convention, the surface is being managed, and there are more useful things to think about today. This is the same deflection she has always used. She is not lying; the knowledge is partitioned away from her.
    `,
  },
});
