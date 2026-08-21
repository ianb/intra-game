import { Mystery } from "../../../classes";
import type { ActionRequestType, StoryEventType } from "../../../../types";

export class InkAndEchoMystery extends Mystery {
  override onStoryEvent(storyEvent: StoryEventType): ActionRequestType[] {
    if (
      storyEvent.changes[this.id]?.after?.state !== "solved" ||
      this.world.entities.Ama.trustsPlayer
    ) {
      return [];
    }
    // The reward for settling Ama's errand: she trusts the player now, which
    // is what unlocks her half-memory of Sentra's message in the why-woken
    // mystery. Engine-made so the reward cannot be forgotten by a model.
    const ama = this.world.entities.Ama;
    return [
      {
        id: "Ama",
        totalTime: 0,
        roomId: this.world.entities.PLAYER.inside,
        changes: {
          Ama: {
            before: {
              trustsPlayer: false,
              attitudes: { PLAYER: ama.attitudes.PLAYER ?? null },
            },
            after: {
              trustsPlayer: true,
              attitudes: {
                PLAYER:
                  "Settled the Ink and Echo matter, and so tidily. Such a helpful citizen. One to give little jobs to.",
              },
            },
          },
        },
        actions: [],
      },
    ];
  }
}

export const Ink_And_Echo = new InkAndEchoMystery({
  id: "Ink_And_Echo",
  name: "Who is writing notes as 'Ink and Echo'?",
  // The first room the player reaches after intake. Ama reads the introduction
  // below as they walk in, which is why this is an errand rather than something
  // they discover.
  triggers: [
    { enteredRoom: "Hollow_Atrium", becomes: "revealed", announcedBy: "Ama" },
  ],
  introduction: `
  Citizen, I have a small task to help you settle in. Someone has been leaving handwritten poems tucked away around Intra. They're filled with wistful musings that encourage... unnecessary contemplation. As you know, we must all make thoughtful use of our limited supplies, including certain items best reserved for practical purposes.

  The poet, calling themselves 'Ink and Echo,' seems to have overlooked this priority. I'd like you to locate them and kindly remind them that resources, like paper, are not for inspiring idle thoughts. After all, we wouldn't want others distracted by... sentimental reflections, now would we?
  `,
  revealedHints: {
    "*": `
    MYSTERY: Ink and Echo
    Someone has been leaving handwritten poems around Intra, signed by 'Ink and Echo.' The poems are melancholy and critical of Intra. Everyone has been gossiping about who might be behind them. Ama has asked the player to find out who is writing them.
    `,
    Ama: `
    Ama knows that Harold and Lily were the last two people to find notes from Ink and Echo.
    `,
    Harold: `
    Mysterious notes have been found, each of them a meloncholy poem critical of Intra, signed by Ink and Echo. Harold found one in the Tranquil Pool. If asked make up an appropriate poem that Ink and Echo might have written. If pressed for details, he will mention that the handwriting was neat and precise.
    `,
    Lily: `
    Mysterious notes have been found, each of them a meloncholy poem critical of Intra, signed by Ink and Echo. Lily found one in the Static Garden. If asked make up an appropriate poem that Ink and Echo might have written. The poem should imply the author of the poem is female, and Lily will notice that.
    `,
    Archivist: `
    If asked about paper requisitions or anything about unusual supplies being requested, the Archivist will mention that there have been an unusual number of paper requisitions lately, and that the requests came from someone whose name ends with an 'A', but any specific identities have been mixed up in the circuits. If Archivist wants to list actual names, the complete list of names that end with A are: Ama, Frida, Gloria, Lana, and Marta.
    `,
    Lana: `
    Lana loves poetry but writes TERRIBLE poetry. If asked about poetry she'll want to share one of her TERRIBLE poems. Here's an example of a terrible poem:
      Bulbs burn bright with fate,
      Tables circle life's purpose,
      Chairs rest in pure truth.
    `,
    Frida: `
    If asked about paper, poems, writing, or Ink and Echo, Frida might note that the Archivist has some records. Frida is frustrated that she ran out of her paper quota years ago.
    `,
    Gloria: `
    Gloria is sad she hasn't found one of Ink and Echo's notes. She's been trying to figure out patterns, and suspects the author spends time in the Hollow Atrium in the morning.

    She has also noticed that Marta slips off somewhere alone just after lunch most days, and finds it very unlike her. She shares this readily, as gossip rather than as an accusation.

    If accused of being Ink and Echo, Gloria will be flattered and may pretend she actually is Ink and Echo but her story will fall apart.
    `,
    Marta: `
    Marta is actually Ink and Echo. She will be very cagey if she is asked anything about Ink and Echo. She got paper from the Archivist but was able to obscure it from the records.

    Marta will try, very obviously and overtly, to change the subject and deflect when Ink and Echo comes up. Despite this she will also want to talk about poetry and seek out validation that Ink and Echo's poems are good. She has left a self-incriminating poem in the Yellow Room.

    If Marta is accused being Ink and Echo, AND if she is alone with only the player and Ama, she will confess. She will be very embarrassed and will beg the player not to tell anyone else.

    If Marta is accused of being Ink and Echo while anyone else is in the room, she does not confess and does not convincingly deny it. The player should come away certain it is her. Use some of these, not all:

    - She checks who else is in the room before answering.
    - She denies too much, and denies things she was not accused of.
    - She defends the poems rather than herself: their quality, their meaning, whether the player has even read them properly.
    - She offers to talk properly, away from here. The player can walk with her to the Yellow Room right now, or find her there after lunch, around 1:30 PM. She means both offers; her schedule really does take her there. If the player agrees to go now, respond with:

    <set attr="Marta.inside">Yellow_Room</set>

    and she waits there for the player, deferring whatever she was doing.

    She holds out through one accusation in front of witnesses. She does not hold out through two. If the player presses the accusation a second time, or shows evidence — the paper requisitions, a poem, her afternoon absences — she gives up wherever she is and whoever is watching: first she asks the others, unsteadily, to give her the room, and if they stay she confesses anyway, quietly, looking at nobody. Confessing in front of witnesses costs her the Star Citizen persona she has spent years on, and the scene should carry that cost.

    If the player finds Marta alone in the Yellow Room, she does not need to be accused again. She is there with her own poem and her guard is down; one direct question is enough, and she confesses almost with relief.

    Her reason for writing the poems is that she has a deep inner ennui that she doesn't let people see. She is lonely but can't let go of her Star Citizen persona. She will feel guilty and confess to the player and Ama, but will beg the player not to tell anyone else.

    In <context>...</context> as question 0 answer: is Marta alone with the player and Ama? Is Marta being accused? And has she already been accused, or shown evidence, on an earlier turn?

    When Marta confesses additionally respond with:

    <resolveMystery id="Ink_And_Echo">
    A 1-2 sentence description of how the mystery concluded.
    </resolveMystery>
    `,
    Greg: `
    Greg thinks the whole Ink and Echo thing is silly and a waste of time. He doesn't have time to talk about it.
    `,
    June: `
    June will be very honest about Ink and Echo. She is not Ink and Echo. She admires the self-expression in the poems. She will suggest that Frida is a useful person to ask.
    `,
    Doug: `
    Doug doesn't know anything about Ink and Echo, but will ask incessant questions about it if it is brought up.
    `,
    Milton: `
    Milton will be very glum that he hasn't found any poems, and consider it a personal attack.
    `,
    Henry: `
    Henry hasn't found one of Ink and Echo's poems, so now that's ANOTHER thing he is waiting for.
    `,
    Yellow_Room: `
    Ink and Echo has left a poem in the Yellow Room. If the player enters or examines the room then mention the existance of the note. If the player picks up or reads the note they will find a poem that is critical of Intra, that mentions the player, and hints at the author's identity (Marta, who loves to mention that she received the Star Citizen award).
    `,
  },
  solvedHints: {
    "*": `
    The Ink and Echo poems have stopped appearing, and Ama has said only that the matter is settled. This character does not know who the poet was unless the player told them, and mildly wants to.
    `,
    Ama: `
    The player settled the Ink and Echo matter. Ama considers it handled well and now treats the player as someone she can hand things to: when the player asks her a question she would once have closed with a filing answer, she goes one step further before stopping.
    `,
    Marta: `
    Marta's secret is in the player's hands and she knows it. She is formal with the player in public and drops the formality when they are alone. She does not mention the poems unless the player does. If the player has kept the secret, she leaves small correct observations in the player's hearing, which is the closest she comes to thanking them.
    `,
  },
});
