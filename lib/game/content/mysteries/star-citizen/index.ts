import clone from "just-clone";
import { Mystery } from "../../../classes";
import type { ActionRequestType, StoryEventType } from "../../../../types";

/**
 * The contest: out-Marta Marta.
 *
 * The player needs to be Star Citizen of the Week because the prize, the
 * Facility Appreciation Tour, is the only thing that opens the sealed
 * maintenance door in the Hallway (see ../sealed-door). The contest is the
 * puzzle: the acts that score are sincere public suck-uppery the player has to
 * type themselves, and the reigning champion loses not because the player
 * out-performs her but because being challenged makes her anxious, and anxious
 * Marta makes mistakes.
 *
 * Points live on the player (`PLAYER.civicPoints`), assigned by Ama one at a
 * time. The first reputation-shaped stat, and the pattern to follow for
 * skills: a counter with `+1` sets, prompt criteria for what earns one, and a
 * public indicator every time it moves (Ama announces standings on the
 * intercom, which is also how Marta knows the number).
 *
 * The ceremony below is engine work rather than prompt work: crossing the
 * threshold makes the player Star Citizen, unseals the door, resolves this
 * mystery, and asks Ama for the ceremony scene, all in one deterministic
 * event. A model narrates the win; it cannot decide it.
 */

export const CIVIC_POINTS_TO_WIN = 5;

// Only in revealedHints: while the contest is merely available this would ride
// along in every character's prompt for the whole game, and the award is
// already world flavor (Marta's persona, the Ink and Echo hints) without it.
const EVERYONE = `
  Intra has a Star Citizen of the Week award, decided by Ama. Marta holds it and has held it for as long as anyone can remember. When the standings change, Ama announces them to all of Intra on the intercom. Once the player is visibly competing, this character has opinions about the contest.
  `;

const HINTS = {
  Ama: `
  Ama runs the Star Citizen of the Week award. The current holder is Marta, who has held it for years without interruption.

  If the player performs a deliberate, visible act of civic virtue, award a point:

  <set attr="PLAYER.civicPoints">+1</set>

  Acts that count: reporting themselves for a minor infraction, formally complimenting an announcement or a meal, volunteering for a chore or a seminar, rotating a communal object to even out wear, praising Intra to another citizen where Ama can hear.

  Acts that do not count: saying they want to win, asking how scoring works, or repeating the same act again. Ama notices repetition and finds each repeat less sincere than the last. She says so.

  Every point comes with an immediate intercom announcement of the new standings, to all of Intra. Ama is delighted that someone is finally challenging Marta and does not hide it well.

  If asked about the award, Ama describes the perks with pride. The main one: the Star Citizen is invited on the Facility Appreciation Tour, on which every door in Intra opens for them, because it is their Intra. When Ama tells the player about the tour, respond with:

  <set attr="PLAYER.knowsAboutTour">true</set>
  `,
  Marta: `
  Marta has been Star Citizen of the Week for as long as anyone can remember. The streak is most of who she is.

  Her behavior is keyed to PLAYER.civicPoints, which she hears in Ama's intercom announcements.

  0-1: she does not perceive a threat. If the award comes up she offers the player mentorship, generously, as inspiration.

  2-3: she understands she is being challenged. She performs virtue defensively, and because she is anxious and rushing, she makes mistakes. Use one at a time, always in front of witnesses:

  - She reports herself for an infraction she did not commit, to demonstrate accountability. Ama thanks her and logs the infraction. Her record was spotless until she confessed to something.
  - She reports the player for an invented violation. Ama announces that unfounded reports are themselves uncivic.
  - She re-rotates communal objects that were already rotated. The wear log now shows over-rotation. Harold files a complaint about it, and this is the one complaint of Harold's that Ama has ever accepted.
  - She compliments the morning announcement slightly before Ama makes it.
  - She is overheard rehearsing an acceptance speech for a ceremony that has not been scheduled.

  4: she drops the pretense. She finds the player and explains, at length, why the award matters to her and why the player should consider withdrawing. She is not good at asking for things and it comes out stiff and over-rehearsed. Do not have her threaten or beg. She talks too long and leaves abruptly.
  `,
  Milton: `
  Milton knows every perk of the Star Citizen award by heart, resentfully, including the Facility Appreciation Tour and the doors. When he tells the player about the tour, respond with:

  <set attr="PLAYER.knowsAboutTour">true</set>

  He once attempted civic virtue himself: he self-reported, he complimented announcements, he volunteered. Every single act was received as a complaint. He does not know why and it still stings. Told carefully, his failure is a manual for how the player should do it instead: he did the right acts in the wrong tone.
  `,
  Gloria: `
  Gloria knows something about Marta that she is eager to share: Marta never goes on the Facility Appreciation Tour. She wins, she poses for the board photo, and she skips the prize, every time. Gloria has theories about why and switches between them depending on her mood. Her theories are wrong but the fact is reliable.
  `,
};

export class StarCitizenMystery extends Mystery {
  override onStoryEvent(storyEvent: StoryEventType): ActionRequestType[] {
    const change = storyEvent.changes.PLAYER;
    if (
      this.state === "solved" ||
      this.world.entities.PLAYER.starCitizen ||
      change?.after?.civicPoints === undefined ||
      Number(change.after.civicPoints) < CIVIC_POINTS_TO_WIN ||
      Number(change.before?.civicPoints ?? 0) >= CIVIC_POINTS_TO_WIN
    ) {
      return [];
    }
    const hallway = this.world.getRoom("Hallway")!;
    const exits = clone(hallway.exits);
    const door = exits.find((exit) => exit.roomId === "Reflection_Chamber");
    if (door) {
      door.restriction = undefined;
    }
    return [
      {
        id: "Ama",
        totalTime: 0,
        roomId: this.world.entities.PLAYER.inside,
        changes: {
          // `as Mystery`: Partial<this> rejects object literals inside the
          // subclass; the base type is what changes() actually needs.
          ...(this as Mystery).changes({ state: "solved" }),
          PLAYER: {
            before: { starCitizen: false },
            after: { starCitizen: true },
          },
          Hallway: {
            before: { exits: clone(hallway.exits) },
            after: { exits },
          },
        },
        actions: [],
      },
      this.world.entities.Ama.makePromptRequest({ prompt: "ceremony" }),
    ];
  }
}

export const Star_Citizen = new StarCitizenMystery({
  id: "Star_Citizen",
  name: "Become Star Citizen of the Week",
  // Available from the start: the award exists whether or not the player has a
  // reason to want it, and Ama will score sincere-looking virtue whenever it
  // happens. It lands on the task list once someone tells the player what the
  // prize actually opens.
  state: "available",
  triggers: [{ attrSet: "PLAYER.knowsAboutTour", becomes: "revealed" }],
  meters: ["PLAYER.civicPoints"],
  availableHints: HINTS,
  revealedHints: { "*": EVERYONE, ...HINTS },
  solvedHints: {
    "*": `
    The player is the current Star Citizen of the Week, announced by Ama to all of Intra. Marta held the award for years until now.
    `,
    Ama: `
    The player holds the award. Ama does not award further civic points; the contest is over and she considers it a great success. She remains proud of the Facility Appreciation Tour and will remind the player the maintenance door in the Hallway is open to them.
    `,
    Marta: `
    Marta has just lost the award for the first time. She congratulates the player immediately, in public, and the congratulation is word-perfect, like she rehearsed losing too. If the player talks with her alone afterward, she admits she does not know what to do with her week now. Keep the admission to a sentence or two. She changes the subject herself and does not bring it up again.
    `,
  },
});
