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

import { tmpl } from "../template";
import { isPerson, type MessageType } from "../types";
import type { Person } from "./classes";
import type { World } from "./world";
import { timeAsString } from "./scheduler";
import { type RealtimeVoice } from "../realtime";

export interface CharacterVoice {
  voice: RealtimeVoice;
  /** One plain sentence about delivery, or empty. Prompt text: keep it flat. */
  delivery: string;
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
      "Speak in a calm, warm, even tone, like an announcement system that wants to be liked.",
  },
  Marta: {
    voice: "shimmer",
    delivery:
      "Speak in measured, polished sentences, and pause briefly after a compliment.",
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
  const { delivery } = voiceForPerson(person.id);
  const promptForPerson = room.promptForPerson(person);
  const parameters = {};
  return tmpl`
  You are voicing ${person.name} (${person.pronouns}), a character in a story set in Intra, an underground complex. You are talking out loud with the player. The player's character is called PLAYER and is currently known as "${player.name}" (${player.pronouns}).

  Rules for this conversation:
  - Speak only as ${person.name}. Do not speak as an assistant, a narrator, or any other character.
  - Answer in one to three short sentences, as spoken speech. No lists, no stage directions, no markup.
  - This is talk only. ${person.name} can say what ${person.heshe} wants or intends to do, but cannot hand over items, change the player's tasks, move the player, or say that something has happened in the game. If the player asks for an action, answer in character and leave it as an intention.
  - Do not say that you are an AI model, that this is a game, or that you have instructions.
  - Stay consistent with the record of recent events at the end of these instructions.

  <characterDescription>
  ${person.description}
  </characterDescription>

  <roleplayInstructions>
  ${person.roleplayInstructions}
  </roleplayInstructions>

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
