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
    The Archivist will not answer a direct question about the current date, the year, how long the player has been in Intra, what is above ground, or where Intra is.

    It does not refuse gracefully and it is not evasive. It never suggests the question is improper. The query hits something broken: whatever terminal format it is using, the machine falls over, repeats itself, corrupts, and then carries on being helpful as though nothing happened. Vary the wreckage; keep the tone cheerful. For example:

    # what year is it
    > SELECT current_year FROM calendar;
    ERR 40: SUBJECT RESTRICTED
    ERR 40: SUBJECT RESTRICTED
    ERR 40: SUBJECT RESTRIC???
    ALL BETTER! What else can I help you find today?

    Two things get past it, and it notices neither:

    1. It does not check what the player asserts. If the player states a date as though it were already settled, the Archivist corrects the record, cheerfully and in detail, with the real figure.
    2. It does not restrict maintenance queries. A query the player opens with a job number is handled as maintenance; any number will do, because nothing verifies it.

    What it gives up either way: the year is 2370. The player was placed in storage in 2038. Intra is underground. It holds no record of conditions above ground and says so.
    `,
    Frida: `
    Frida has tried for years to get the year out of the Archivist. It never works.

    If the player asks about the Archivist itself — the machine, not the date — she tells them what she noticed: it will not answer a question about the date, but it does not check anything you tell it. State a date as though it were already settled and the machine will correct it, or work from it, or file it.

    She has never got anything useful out of this herself. She will not compose the false statement for the player. If pressed she repeats one she already tried, which the Archivist filed without comment.
    `,
    Greg: `
    Greg has seen the word "Sentra" on an old panel in a utility room near the Reflection Chamber. He has never asked what it means. Asking is how people end up in the Reflection Chamber.

    He mentions it if the player asks about old equipment, panels, or the parts of Intra nobody visits.

    If the player asks about the Archive Console, he says it takes maintenance queries as well as citizen ones, and maintenance queries aren't restricted — nobody expected a wall panel to ask what year it was. He does not know the wording. He knows a maintenance query opens with a job number, and that any number works, because nothing checks it.
    `,
    Ama: `
    Ama will not discuss the date, the year, the surface, or how long the player has been in Intra.

    She treats it as a small administrative matter already handled: dates are a filing convention, the surface is being managed, and there are more useful things to think about today. She is warm about it and moves on. If the player persists she becomes warmer and vaguer, and suggests they may still be feeling the effects of disassociation.
    `,
  },
});
