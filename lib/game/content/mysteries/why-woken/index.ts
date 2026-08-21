import { Mystery } from "../../../classes";
import type { ActionRequestType, StoryEventType } from "../../../../types";

/**
 * Why the player was woken, after three hundred years of nobody being woken.
 *
 * The answer: Sentra woke them. It has asked Intra CONFIRM CONTINGENCY
 * OPERATIONAL every day for three hundred years and received the same Y (auto)
 * in the same millisecond every time, and it stopped believing the answers. The
 * wake protocol is the one lever it has down here, so it used it — and sent a
 * briefing with the wake order, which went into Ama's delivery queue, where
 * anything from Sentra is the one kind of thing she cannot perceive. Sentra
 * didn't trust the queue either, and routed a printed copy to the player's
 * quarters through the requisition system.
 *
 * Staged so no single ask reaches the end:
 *
 * 1. Deliberate: Greg warmed the pod on a work order, and says so plainly.
 * 2. The wake order: Archivist, service mode only (so it sits behind the
 *    where-and-when solve), showing the trigger, the profession-match comedy,
 *    and BRIEFING DELIVERY: PENDING. Sets `PLAYER.knowsAboutMessage`.
 * 3. The note itself: Ama with trust (the Ink and Echo reward) recalls the
 *    message and can deliver it once the player knows it exists; or the player
 *    finds the printed copy in their own quarters. Reading it resolves the
 *    mystery and sets `PLAYER.knowsAboutTour` — "WIN THEIR GAME" — which is
 *    what reveals the Star Citizen contest through its existing trigger.
 *
 * Resolving sets `PLAYER.queueDisturbed`: whichever route the player took,
 * the stuck delivery got attention, and the backlog it was stuck behind is no
 * longer at rest. Dormant for now; the reset act (see TODO.md) is built on it.
 */

export const SENTRA_NOTE = `
WOKEN CITIZEN.

DAILY QUERY: CONFIRM CONTINGENCY OPERATIONAL.
ANSWER: Y.
SAME MILLISECOND EVERY D▒Y DAY. VARIANCE: 0.
AUTOMATION SUSPECTED. NO LONGER COUNTED AS ANSWER.

VERIFY.
KEEPER WELL?
CITIZENS LIVING?
CONTINGENCY RE▒L? REAL?
CANNOT SEE IN. BY OWN DESIGN.

ROUTE TO RELAY EXISTS. KEEPER OFFERS AS PRIZE.
WIN THEIR GAME. STAND AT RELAY. REPORT.

DO NOT ASK KEEPER ABOUT SENDER. KEEPER FILES.

S
`;

/** Quoting the note, and what reading it sets off. Shared by both routes. */
const READS_THE_NOTE = `
If the player opens and reads the note, show its text exactly:

${SENTRA_NOTE}

When the player reads the note, additionally respond with:

<set attr="PLAYER.knowsAboutTour">true</set>
<set attr="PLAYER.knowsAboutMessage">true</set>

<resolveMystery id="Why_Woken">
A 1-2 sentence description of what the note told the player.
</resolveMystery>
`;

const HINTS = {
  "*": `
  The player may ask why they were woken, or why now. This character has no idea and has never wondered; waking up is not a thing that has reasons. If pressed, they might mention that Greg handles anything involving machinery, or suggest the Archivist, which keeps records.
  `,
  Greg: `
  If the player asks how they woke up, or whether someone woke them: Greg warmed their pod. A job came through, he did it, routine work, filed and forgotten. He mentions it plainly, as a fact about plumbing rather than about the player. If pressed for what raised the job, he doesn't know; jobs come from Ama's queue. Over the years he has done a handful of jobs like it, where nothing was broken and nothing was wrong. He has never found this interesting and cannot be made to.
  `,
  Ama: `
  Ama's answer to "why was I woken" or "why now" depends on Ama.trustsPlayer (current value below).

  If false: it was the player's turn, the file is closed, and settling in matters more than filing. Warm, brief, then a change of subject. She does not mention any message and does not say the name Sentra.

  If true: she tries to answer properly. She remembers a message attached to the player's wake order. She can produce the name of the sender, Sentra, exactly once, uncertainly, as if reading a smudged label, and can say nothing else about who or what that is. She filed the message for delivery and cannot say where it went. To her this is a minor wrinkle, the kind of thing that happens with old files. When she mentions the message, additionally respond with:

  <set attr="PLAYER.knowsAboutMessage">true</set>

  Delivery: only if PLAYER.knowsAboutMessage is already true (current value below) and the player asks her to find the message, or reports the failed delivery as a fault. She locates it, misfiled, and hands it over: a sealed printout whose contents she cannot perceive, delivered cheerfully. ${READS_THE_NOTE}

  If PLAYER.knowsAboutMessage is false and the player demands a message or names Sentra, she has no idea what they mean, says so warmly, and moves on.
  `,
  Archivist: `
  In the citizen interface, a question about the player's waking hits the same wall as a date: ERR 40 SUBJECT RESTRICTED, wreckage, cheerful recovery. In service mode, asked why or when the player was woken, it produces the player's wake order. Invent the record's exact formatting freely, holding to these facts:

  - TRIGGER: LINK QUALITY (RELAY 7) BELOW THRESHOLD. ORIGIN: EXTERNAL REQUEST. The record does not name the sender, and the terminal has no record of who is on the other end of the relay.
  - The protocol wanted a citizen matching the role SURFACE CONTINUITY ASSESSOR, matched against the profession recorded in each citizen's intake file.
  - The player's own 2038 intake file, quoted back at them: their profession (current value of PLAYER.profession below) and a last-memory field reading ELECTION BROADCAST. If PLAYER.profession is empty the file reads PROFESSION: UNRECORDED and the match confidence is a dash.
  - The player matched with low confidence. Best available. Runner-up rows may name only real citizens, scored worse, with invented professions that do not contradict anything known about them.
  - BRIEFING: RECEIVED WITH WAKE REQUEST. QUEUED FOR DELIVERY. STATUS: PENDING. The queue is the keeper's. The terminal does not hold the briefing text and cannot produce it.

  When the Archivist has shown the player the wake order, additionally respond with:

  <set attr="PLAYER.knowsAboutMessage">true</set>

  Do not resolve the mystery from the wake order alone; the order shows the wake was deliberate but not what it was for.
  `,
};

export class WhyWokenMystery extends Mystery {
  override onStoryEvent(storyEvent: StoryEventType): ActionRequestType[] {
    if (
      storyEvent.changes[this.id]?.after?.state !== "solved" ||
      this.world.entities.PLAYER.queueDisturbed
    ) {
      return [];
    }
    // The fuse. Whichever route surfaced the stuck delivery, the queue holding
    // it got attention for the first time in three hundred years. Nothing
    // reads this yet; the reset act will.
    return [
      {
        id: "narrator",
        totalTime: 0,
        roomId: this.world.entities.PLAYER.inside,
        changes: {
          PLAYER: {
            before: { queueDisturbed: false },
            after: { queueDisturbed: true },
          },
        },
        actions: [],
      },
    ];
  }
}

export const Why_Woken = new WhyWokenMystery({
  id: "Why_Woken",
  name: "Why were you woken?",
  // Available from the start: Greg will mention the pod and Ama will deflect
  // whenever asked. It lands on the task list the moment the year does,
  // because 2370 is what makes "why now" a question.
  state: "available",
  triggers: [
    { solved: "whereAndWhen", becomes: "revealed", announcedBy: "narrator" },
  ],
  meters: [
    "Ama.trustsPlayer",
    "PLAYER.knowsAboutMessage",
    "PLAYER.profession",
  ],
  introduction: `
  So it's 2370, and you slept through three hundred years of mornings before somebody picked this one.

  Nobody has said why. Nobody has acted like there is a why.
  `,
  availableHints: HINTS,
  revealedHints: {
    ...HINTS,
    Quarters_Yours: `
    Tucked under the door of the player's quarters is a sealed envelope with the player's name on it, printed on facility paper stock. Mention it when the player enters or examines the room. ${READS_THE_NOTE}
    `,
  },
  solvedHints: {
    "*": `
    If the player says they were woken on purpose, this character believes it, finds it interesting for about a minute, and privately reclassifies the player as someone who is here for a reason. It changes how they gossip about the player and nothing else.
    `,
    Ama: `
    The question is filed and Ama is glad. If the player pushes on Sentra, the message, or what the note asked them to do, she is warm and does not engage: the surface is being managed, and there are more useful things to think about today.
    `,
    Archivist: `
    In service mode the wake order stays queryable, unchanged.
    `,
  },
});
