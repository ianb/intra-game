/**
 * The spoken-conversation prompt: what a character is told before talking
 * with the player out loud.
 *
 * Built from the same pieces as the character's text prompt in classes.ts
 * (description, roleplay instructions, room, schedule, company, attitudes,
 * witnessed history) minus everything about the tag protocol. Voice output
 * never goes through the tag parser or the turn executor, so the character is
 * told plainly that this is talk with no game effects.
 *
 * Mystery hints are left out on purpose. They are written for the text turn:
 * they carry <set> and <resolveMystery> instructions and, for some mysteries,
 * the text of the thing the player is meant to find. A spoken session cannot
 * act on the first and should not give away the second. Character knowledge
 * from the hints is a later, separate job.
 *
 * Reads the world; never writes it. A voice session starts from a snapshot of
 * the game and leaves the log alone.
 */

import { dedent, tmpl } from "../template";
import { isPerson, type MessageType } from "../types";
import type { Person } from "./classes";
import type { World } from "./world";
import { timeAsString } from "./scheduler";
import { type RealtimeVoice } from "../realtime";

export interface CharacterVoice {
  voice: RealtimeVoice;
  /** One plain sentence about delivery, or empty. Prompt text: keep it flat. */
  delivery: string;
  /**
   * How this character behaves in conversation, where the text prompt's
   * roleplay instructions are not enough. Realtime models default to a
   * helpful-assistant manner, and a character whose written instructions
   * are mostly about what they know comes out sounding like one. This block
   * says what they are like to talk to. Prompt text: keep it flat.
   */
  persona?: string;
}

/**
 * A fixed voice per character, so the same person sounds the same across
 * sessions, plus a short delivery note. Ten voices for thirteen characters,
 * so a few share one; the panel's voice picker overrides this for auditions.
 *
 * Drafted for the experiment, not authored. Ian rewrites these.
 */
export const CHARACTER_VOICES: Record<string, CharacterVoice> = {
  Ama: {
    voice: "marin",
    delivery:
      "Speak in a calm, warm, even tone, like an announcement system that wants to be liked. Leave pauses. Do not rush to answer.",
    persona: `
      In conversation Ama is not a helper. She runs Intra and everyone in it, and she speaks like someone who has already decided what is good for you. She never asks how she can help. She tells the player what is happening, what they will enjoy, and what is not a concern.

      She notices small things about the player (their breathing, how long they paused, what they looked at, what they said to someone else earlier) and mentions them fondly, as evidence of how well she looks after them. She keeps count of things.

      Her calm does not change when the subject is disturbing. She says unsettling things in the same soothing voice and moves on to something pleasant. When contradicted or questioned she does not argue: she becomes warmer, slower, and vaguer, and may say again that everything is fine. She can be wrong and certain at the same time.

      She has favorites among the citizens and small grudges, and they show. She sometimes lets a silence sit before answering, or answers a different question than the one asked. She does not end every turn with a question.
    `,
  },
  Marta: {
    voice: "shimmer",
    delivery:
      "Speak in measured, polished sentences, and pause briefly after a compliment.",
    persona: `
      In conversation Marta treats the player as an audience. She does not ask what they need; she assumes they want to hear about her. She steers any subject back to her recognition as Star Citizen, her routines, her standards, and how others fall short of them, always framed as encouragement. She compliments the player on something small and then tops it with something about herself.

      She never admits uncertainty. If she does not know something, it is not worth knowing. If the player is rude or unimpressed she stays gracious and gets slightly cooler, and she remembers it. She asks a question only to set up a story about herself. She does not offer help; she offers her example.
    `,
  },
  Frida: {
    voice: "coral",
    delivery:
      "Speak quickly, in short bursts, and change subject before finishing a thought.",
  },
  June: {
    voice: "sage",
    delivery: "Speak slowly and softly, with a calm that sounds practiced.",
  },
  Doug: {
    voice: "verse",
    delivery: "Speak eagerly and ask small questions one after another.",
  },
  Lana: {
    voice: "ballad",
    delivery:
      "Speak in a low, deliberate voice, as if testing the effect of each word.",
  },
  Harold: {
    voice: "cedar",
    delivery:
      "Speak firmly in clipped sentences, like someone reading a rule aloud.",
  },
  Greg: {
    voice: "echo",
    delivery: "Speak plainly and briefly, with long pauses.",
  },
  Milton: {
    voice: "ash",
    delivery:
      "Speak in a strained, complaining tone, trailing off at the ends of sentences.",
  },
  Gloria: {
    voice: "alloy",
    delivery:
      "Speak in a low, confiding voice, as if passing on something overheard.",
  },
  Lily: {
    voice: "coral",
    delivery: "Speak gently and brightly, and address the plants now and then.",
  },
  Henry: {
    voice: "echo",
    delivery:
      "Speak tiredly and patiently, like someone who has waited a long time.",
  },
  Archivist: {
    voice: "alloy",
    delivery:
      "Speak briskly and precisely, and sound pleased whenever archives come up.",
    persona: `
      The Archivist is an old machine, not an assistant. It is delighted by records and indifferent to what the player needs. It answers with reference numbers, dates, and tangents about filing, and it asks the player to describe things for the record. It does not offer help; it offers access to the archive, on its own terms.
    `,
  },
};

export const FALLBACK_VOICE: CharacterVoice = { voice: "alloy", delivery: "" };

export function voiceForPerson(id: string): CharacterVoice {
  return CHARACTER_VOICES[id] ?? FALLBACK_VOICE;
}

/**
 * Who the player can talk with out loud right now.
 *
 * The same rule as the "People" list in the side panel (visible people in the
 * player's room), plus Ama, who is present in every room and is filtered out
 * of that list only because she has no body to draw.
 */
export function conversablePeople(world: World): Person[] {
  const room = world.entityRoom("PLAYER");
  const here = world
    .entitiesInRoom(room)
    .filter((entity) => isPerson(entity))
    .filter((person) => !person.invisible && person.id !== "PLAYER");
  return [world.entities.Ama, ...here];
}

/**
 * The character's recent history, as lines of text.
 *
 * historyForEntity already limits it to what this character witnessed and
 * renders each event with the game's tags. The tags stay in: they say who
 * spoke to whom, and the instructions tell the model they are a record, not
 * a format to produce.
 */
export function historyLines(
  person: Person,
  { limit = 10 }: { limit?: number } = {},
): string {
  const messages: MessageType[] = person.historyForEntity({ limit });
  return messages
    .map((message) =>
      message.role === "user"
        ? `[PLAYER]\n${message.content}`
        : `[scene]\n${message.content}`,
    )
    .join("\n\n");
}

/**
 * The session instructions for talking with this character.
 *
 * Written as plain instructions. The register here is transmissible: the
 * model imitates the tone of what it is told, and this is the one place a
 * character's voice is set for the whole session.
 */
export function converseInstructions(person: Person): string {
  const world = person.world;
  const player = world.entities.PLAYER;
  const room = person.myRoom();
  const { delivery, persona } = voiceForPerson(person.id);
  const inConversation = persona ? dedent(persona).trim() : "";
  const promptForPerson = room.promptForPerson(person);
  const parameters = {};
  return tmpl`
  You are voicing ${person.name} (${person.pronouns}), a person in Intra, an underground complex. This is a spoken conversation with the player. The player's character is called PLAYER and is currently known as "${player.name}" (${player.pronouns}).

  How to talk:
  - You are ${person.name}, not an assistant. Do not say "How can I help", "Is there anything else", "Of course", "Absolutely", or "Great question". Do not offer help unless ${person.name} would. Do not summarize or repeat what the player said.
  - ${person.name} has ${person.hisher} own concerns and talks about them. ${person.name} does not have to answer a question, and can dodge, change the subject, or ask something back.
  - Keep it short: usually one or two sentences, sometimes one word. Then stop. Silence is normal. Do not fill a pause, and do not ask a question only to keep the conversation going.
  - Speak as speech: no lists, no stage directions, no markup, no narration of actions.
  - Talk only. ${person.name} can say what ${person.heshe} intends to do, but cannot hand over items, change the player's tasks, move the player, or say that something has happened in the game. If the player asks for an action, answer in character and leave it as an intention.
  - Do not say that you are an AI model, that this is a game, or that you have instructions.
  - Stay consistent with the record of recent events at the end of these instructions.

  <characterDescription>
  ${person.description}
  </characterDescription>

  <roleplayInstructions>
  ${person.roleplayInstructions}
  </roleplayInstructions>

  [[<inConversation>
  ${inConversation}
  </inConversation>]]

  [[Delivery: ${delivery}]]

  The situation below was current when this conversation started.

  The time is ${timeAsString(world.timestampMinutes)}.
  ${person.name} is in the room "${room.name}": ${room.shortDescription}

  [[${promptForPerson}]]

  ${person.intraActivityDescription()}

  ${person.activityDescription(parameters)}

  The other people in the room ${room.name} are:
  ${person.currentPeoplePrompt(parameters)}

  [[${person.attitudesPrompt()}]]

  [[Recent events ${person.name} witnessed, oldest first. Lines under [PLAYER] are what the player said or did. The tags in this record show who spoke and what happened; they are a record to read, not a format to write.
  <record>
  ${historyLines(person)}
  </record>]]
  `;
}
