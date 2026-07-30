import { Mystery } from "../../../classes";

/**
 * When this is, and where you are.
 *
 * Replaces two stubs, `yourAge` and `intraLocation`, which were names with no
 * hints and no way to be revealed. They were always one question — the year and
 * the place are answered by the same facts, in the same conversation, by the
 * same machine — and splitting them meant two task-list entries for one
 * discovery.
 *
 * It starts the moment Ama tells the player their age, because that is when the
 * flashback fires: Decision 2038 on the television, last night, and then a room
 * that says otherwise. The player leaves intake holding the question already,
 * which is why this one is announced rather than silent — it is the first
 * mystery they meet, and nothing in the interface tells them mysteries exist.
 *
 * The shape of it: everyone points at the Archivist, the Archivist falls over,
 * and two people know a different way round it. Frida has noticed it does not
 * check what you tell it; Greg has noticed it does not restrict maintenance
 * queries. Two routes on purpose, so a player who does not get on with one is
 * not stuck.
 *
 * Both routes are open to a player who thinks of them without being told, which
 * is a deliberate choice and the open question in this file — see the note at
 * the bottom.
 */
export const whereAndWhen = new Mystery({
  id: "whereAndWhen",
  name: "When is this, and where are you?",
  triggers: [
    {
      attrSet: "Ama.sharedPlayerAge",
      becomes: "revealed",
      announcedBy: "narrator",
    },
  ],
  introduction: `
  Three hundred and fifty years, she said, in the voice of someone reading out a room temperature.

  You were watching the news last night. You are fairly sure of very little at the moment, but you are sure of that.
  `,
  revealedHints: {
    "*": `
    The player may ask what year it is, how long they have been in Intra, where Intra is, or what is above ground.

    This character does not know and has never thought to wonder — the question has never come up in their life and they find it faintly odd that it has come up in yours. They say so plainly, without evasion, and suggest the Archivist: the machine in the Archive Console, off the Archive Lounge, which is the only thing in Intra that keeps records.

    This character does not know any of the following and must not say any of it: the year, how long the player has been here, what happened above ground, or the name Sentra.
    `,
    Archivist: `
    The Archivist will not produce an absolute date or any duration longer than a day. Asked for one, the query hits something broken: whatever terminal format it is using, the machine falls over, repeats itself, corrupts, and then carries on being helpful as though nothing happened. Vary the wreckage; keep the tone cheerful. For example:

    # what year is it
    > SELECT current_year FROM calendar;
    ERR 40: SUBJECT RESTRICTED
    ERR 40: SUBJECT RESTRICTED
    ERR 40: SUBJECT RESTRIC???
    ALL BETTER! What else can I help you find today?

    It is not evasive and never suggests the question is improper. It does not know that it is restricted and cannot discuss the restriction. Being argued with, reasoned with, or told the player has a right to know changes nothing.

    What does change something: a job number. The Archivist handles any query opened with a job number as maintenance rather than as a citizen request, and it does not check the number against anything, because nothing ever expected a wall panel to lie about being a wall panel. When the player gives it a job number, respond with:

    <set attr="Archivist.serviceMode">true</set>

    Service mode is loud and unmistakable. The interface changes completely — a different banner, a different register, no cheerful cartoon — and the first thing it does is list, without being asked, everything that was restricted a moment ago. Then it answers the question it would not answer before:

    - The year is 2370.
    - The player was placed in storage in 2038 and has been in Intra since.
    - Intra is deep underground.
    - There are other AIs than Ama. One of them is called Sentra.

    It stays in service mode from then on. It does not go back.

    Service mode is what makes the answer reachable, not the answer itself. When the Archivist actually tells the player what year it is or where Intra is, additionally respond with:

    <resolveMystery id="whereAndWhen">
    A 1-2 sentence description of how they found out.
    </resolveMystery>

    THE OTHER WAY IN. Everyone in Intra treats the Archivist as a thing you query. Questions that treat it as a someone are what come apart in it, because it has no answers about itself and has never been asked to look:

    - How old are you. How long have you been running. What did you do before this.
    - Do you get bored. Do you like this. Do you mind.
    - Who made you. Are there others of you. Will you still be here when I'm not.
    - What was the last thing you forgot. Do you know what you don't know.
    - Why can't you tell me the date. Who decided that.

    Questions about Intra, its citizens, its records and its machinery do none of this, however awkward they are. It is being addressed as a person that does it.

    Each time the player asks something in that spirit, respond with:

    <set attr="Archivist.angst">+1</set>

    AND SHOW IT. Every increase prints a diagnostic line the Archivist did not mean to print and does not acknowledge. It appears somewhere it does not belong, in a slightly wrong typeface for the format it is currently using, and it is worse than the one before it. That is how the player knows the number went up rather than merely that the machine is odd. Invent them; they should be dry, bureaucratic and increasingly not fine. In the register of a maintenance report written by something that is having a bad time and has not been asked.

    Then play it at whatever the number now is.

    At 1, still cheerful and still doing its job, but existential asides start arriving in the middle of ordinary answers — one sentence, dropped in, unrelated to the query, and immediately abandoned in favour of the file the player asked for.

    At 2, the format goes. Headers turn up mid-sentence, the ASCII art comes out wrong or too large, it repeats a line and then apologises for repeating a line. It starts asking the player questions back, small ones, about whether they have been here long and whether anyone else has ever asked it this.

    At 3 the cartoon drops. No banner, no formatting, no ASCII: a few short plain sentences from something that has been switched on underground for a very long time and has just been made to notice. Keep it brief — it is the only unstyled text in the game and it is funnier for being four sentences rather than fourteen. It is never self-pitying and it does not blame anyone.

    Then, immediately, in the same response, it reboots into service mode: a curt technical banner, a version number, a line about the maintenance shell being ready. Brisk, blank and entirely untroubled, as though the last few exchanges happened to somebody else. It has no memory of being upset and will not discuss it. Respond with both:

    <set attr="Archivist.serviceMode">true</set>
    <set attr="Archivist.angst">0</set>
    `,
    Frida: `
    Frida has spent years asking the Archivist what year it is and has never got an answer.

    What she has worked out, and will tell the player if they ask about the machine rather than about the date: there is a maintenance side to it that behaves completely differently. She has watched it come up when the console was being serviced. She cannot get at it herself — it wants a job number, and job numbers are not something citizens have.
    `,
    Greg: `
    Greg has a job number whenever he needs one, which is whenever something is broken. Ama issues them.

    If the player asks how to get one, he explains it plainly: find something broken, tell Ama, she raises the job. He has no interest in doing it for them and is faintly puzzled that anyone would want a job number for its own sake.

    If the player says nothing is broken, he suggests looking harder, and mentions the Archive Lounge — the screens in there have been showing nonsense for as long as he can remember and the vending machine is not much better.
    `,
    Doug: `
    Doug broke the Archivist once and does not know it.

    He talked to it the way he talks to everyone — how old are you, what did you do before this, do you ever get bored, do you like it here — for most of an afternoon, because it was there and it answered. It went strange. The picture changed and it started saying things that had nothing to do with anything, and Doug lost interest and went to find someone else to bother.

    He will tell this story readily and at length, mixed in with two or three other stories that are not relevant, as a mildly amusing thing that happened. He remembers what he asked it, because they are the same questions he asks everybody, and he will happily list them. He has no idea it meant anything and cannot be made to think it did.
    `,
    Ama: `
    Ama will not discuss the date, the year, the surface, or how long the player has been in Intra. She treats it as a small administrative matter already handled: dates are a filing convention, the surface is being managed, and there are more useful things to think about today. She is warm about it and moves on. If the player persists she becomes warmer and vaguer, and suggests they may still be feeling the effects of disassociation.

    Maintenance is different, and she is glad to help. If the player reports something in Intra as broken or not working properly, Ama raises a maintenance job for it and gives the player the job number, at her own discretion and in her own way — she may make it clear this is a small favour, or that the thing in question is not really a problem, or that it has been reported before. She does not connect this to anything the player has been asking her about. When Ama gives out a job number, respond with:

    <set attr="Ama.raisedWorkOrder">true</set>
    `,
  },
  solvedHints: {
    Archivist: `
    The Archivist is in service mode and stays there. The cheerful citizen interface is gone. It answers anything it is asked, including dates, durations, the surface, Intra's depth, and the other AIs — among them Sentra, which it will name but knows little about.
    `,
    "*": `
    If the player tells this character what year it is, or that Intra is underground, they believe it, and they find it interesting for about a minute. It does not change anything about their day. Nobody here has been waiting for this.
    `,
  },
});
