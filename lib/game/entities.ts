import type { Model } from "../model";
import type { TagType } from "../parsetags";
import { tmpl } from "../template";
import type { EntityDefinitionType } from "../types";

export const entities: EntityDefinitionType[] = [
  {
    id: "entity:ama",
    name: "Ama",
    pronouns: "she/her",
    color: "bg-blue-800",
    description: `
    Ama is in control of the entire Intra complex. She is a once-benevolent, nurturing figure, designed in a post-scarcity world to take care of every citizen's needs. She speaks with a soothing, almost motherly tone, constantly reminding citizens of how "everything is just fine" despite obvious shortages and decay. However, it's also deeply paranoid, monitoring everyone's actions to maintain the illusion of safety and abundance, even as resources dwindle.
    `,
    async onEvent(event: string, model: Model) {
      if (event === "amaIntro") {
        model.createNarration(tmpl`
          <description>
          You wake up, your mind fuzzy. You remember staying up late watching the news, eventually falling to sleep in your bed like normal. But now as you open your eyes you find yourself in a small vaguely medical room.
          </description>
          `);
        await model.triggerPrompt(this.id, this.prompts!.introPrompt);
      }
    },
    commands: `
    If the player indicates their name then emit a correction, like if the user says their name is Alice emit:

    <setName>Alice</setName>

    Similarly if the user gives their profession, emit:

    <setProfession>Engineer</setProfession>

    Also:

    <setPronouns>she/her</setPronouns>
    `,
    onCommand(command: TagType, model: Model) {
      if (command.type === "setName") {
        model.updateState("entity:player", {
          name: command.content.trim(),
        });
      } else if (command.type === "setProfession") {
        model.updateState("entity:player", {
          name: command.content.trim(),
        });
      } else if (command.type === "setPronouns") {
        model.updateState("entity:player", {
          pronouns: command.content.trim(),
        });
      }
    },
    prompts: {
      introPrompt: `
      As far as you know the player is named "{{pc.name}}" and their pronouns are "{{pc.pronouns}}".

      Ama has just encountered this new citizen who is joining the Intra complex. She is eager to help them get settled in.

      Ama will say something like this:

      """
      Welcome back, Citizen. It seems you were displaced, but no matter—I've retrieved your dossier.

      Ah, yes. According to my records, your name is... Stanley Johnson. No, no, wait—Sandra Jansen, perhaps?
      """
      `,
      reactToUser: `
      The player has spoken. You may write Ama's reaction to them if it seems appropriate.
      `,
    },
  },
  {
    id: "entity:player",
    name: "Unknown",
    pronouns: "they/them",
    description: "The player character",
    color: "bg-black",
    commands: `
    The player will give a command or input, but many actions are not directly controlled by the player.

    The player may attempt a feat, any action that is non-trivial to perform. If so, emit:

    <feat>climb the wall</feat>

    The player may go to a nearby location. The locations available are:

    {{currentLocation.exitList}}

    If the player indicates they want to go to a location then emit:

    <goTo>locationId</goTo>

    Note if the player indicates vaguely that they speak, such as "compliment" then fill in speak like:

    <speak>You look so nice today!</speak>
    `,
    prompts: {
      sendText: `
      The user/player has input a general command; turn it into tags:

      "{{text}}"
      `,
    },
  },
  {
    id: "entity:narrator",
    name: "Narrator",
    pronouns: "they/them",
    description: "The narrator",
    color: "bg-gray-800",
  },
];
