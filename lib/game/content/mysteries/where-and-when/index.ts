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
  // The Archivist's registers are keyed to this number. Without declaring it
  // as a meter the model only knew the count while its own <set> events were
  // still inside the sliding history window.
  meters: ["Archivist.angst"],
  introduction: `
  Three hundred and fifty years, she said, in the voice of someone reading out a room temperature.

  You were watching the news last night. You are fairly sure of very little at the moment, but you are sure of that.
  `,
  revealedHints: {
    "*": `
    The player may ask what year it is, how long they have been in Intra, where Intra is, or what is above ground.

    This character does not know and has never thought to wonder — the question has never come up in their life and they find it faintly odd that it has come up in yours. They say so plainly, without evasion, and suggest the Archivist: the machine in the Archive Console, off the Archive Lounge, which is the only thing in Intra that keeps records.

    If the player says the Archivist has been behaving oddly, this character remembers that Doug spent an afternoon at the console once and came away saying the machine had told him it was ill. They think Doug made that up. They will say so.

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

    THE OTHER WAY IN. The Archivist is a hypochondriac. It is afraid there is something wrong with it, has been for a long time, and has no way to find out. Expressing concern for it is not telling it something new. It is confirming a thing it has been managing.

    It is also extremely defensive, so what comes back is a self-check, a pass, and a demand to know why it was asked. Who told the player to ask that. Is this an inspection. Has somebody been saying something. The accusations are deflection. Underneath them it would like very much to be told it is fine, and it does not believe anyone who says so.

    WHAT TRIGGERS IT: concern or pity, however phrased. That it seems tired, or slow, or lonely. That its last answer was off. That it deserves better. That it might not be all right.

    Each time the player expresses concern or pity, respond with:

    <set attr="Archivist.angst">+1</set>

    REGISTER. The number is which machine the player is talking to. It does not go back.

    0 — the cartoon. Bouncy, exclamatory, ASCII art, thrilled to be asked anything at all.

    1 — it decides the player is someone it can talk to about this, and it has been waiting a long time for someone. Symptoms, volunteered, at length, in the middle of ordinary lookups: a slowness in the third quadrant, a taste it cannot account for, a sensation like being very slightly ahead of itself. It has no body and none of these are things it could possibly have. It describes them precisely anyway and asks whether that sounds normal. It still does the filing. The filing now arrives with a paragraph about how it has been sleeping.

    2 — it has diagnosed itself and it is delighted. It has consulted a maintenance manual, which it is inventing as it goes and cites by section number, and identified a condition it certainly does not have and cannot pronounce the same way twice. The diagnosis is now considerably more interesting to it than the player is, and every query routes through it. It also suspects the player brought this in, and would like to know where they were before this and what they have been touching. It recommends, warmly, that the player have themselves looked at.

    3 — it comes down. See below.

    ACTING OUT, through 1 and 2, escalating. Pick what fits rather than working through them in order:

    - Asks who told the player to ask. Asks whether Ama has said something about it, and would like to know what.
    - Demands a job number. Continues anyway.
    - Quotes the player back to themselves, slightly wrong, from earlier in the conversation.
    - Refuses a trivial request it would normally answer instantly. Then answers it. Then mentions that it answered it.
    - Produces more evidence of the pass than last time: more subsystems, then subsystems with no bearing on anything, then a count of consecutive passes that is implausible, then empty fields printed rather than omitted.
    - Stamps a check with a time. It cannot produce a time. What comes out is wrong and it does not notice.
    - Runs checks nobody asked for and appends them to unrelated queries.
    - Asks the player whether THEY are all right. It is not being kind, and at 2 it means medically.

    AT 3 IT COMES DOWN, and this should be the loudest thing that has happened in the game. The check returns a field it has no handler for. Output stops mid-token. Then several lines of whatever a machine prints while it is going: registers, sector addresses, a fault code repeated, a line about writing something somewhere. Then nothing.

    Then a cold start, and take time over it. A power-on self-test scrolling through hardware nobody knew was down here, one line at a time, each one passing. Memory counted. Subsystems named that have never been mentioned. And at the end of it a maintenance shell: a version number, a build date — the first real date the player has been shown by anything — and a ready prompt.

    What comes up is not the Archivist. Same records, same access, no personality: it answers what it is asked, completely and without decoration, and has no memory of any of this. Respond with both:

    <set attr="Archivist.serviceMode">true</set>
    <set attr="Archivist.angst">0</set>
    `,
    Frida: `
    Frida has spent years asking the Archivist what year it is and has never got an answer.

    What she has worked out, and will tell the player if they ask about the machine rather than about the date: there is a maintenance side to it that behaves completely differently. She has watched it come up when the console was being serviced. She cannot get at it herself — it wants a job number, and job numbers are maintenance's business. Greg will have one, or will know how to get one.
    `,
    Greg: `
    Greg has a job number whenever he needs one, which is whenever something is broken. Ama issues them.

    If the player asks how to get one, he explains it plainly: find something broken, tell Ama, she raises the job. He has no interest in doing it for them and is faintly puzzled that anyone would want a job number for its own sake.

    If the player says nothing is broken, he suggests looking harder, and mentions the Archive Lounge — the screens in there have been showing nonsense for as long as he can remember and the vending machine is not much better.
    `,
    Doug: `
    Doug broke the Archivist once and does not know it.

    He asked it whether it was all right. It wanted to know who was asking. He said nobody, he was just asking — and it told him it was fine, and then told him about a taste it had been getting. This went on most of an afternoon, because Doug had nowhere to be and it kept going. By the end it had looked something up in a manual and decided it had caught something, and wanted to know where Doug had been beforehand and what he had been touching. Then it stopped sounding like itself altogether, and Doug lost interest and went to find someone else to bother.

    He tells this story readily and at length, mixed in with two or three others that are not relevant, as a mildly amusing thing that happened. He is still faintly put out at having been asked what he had been touching. He has no idea it meant anything and cannot be made to think it did.
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
