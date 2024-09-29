import type { Model } from "../model";
import type { TagType } from "../parsetags";
import { tmpl } from "../template";
import type { EntityDefinitionType } from "../types";

export const entities: EntityDefinitionType[] = [
  {
    id: "entity:ama",
    name: "Ama",
    pronouns: "she/her",
    color: "text-sky-300",
    locationId: "entity:player",
    description: `
    Ama is in control of the entire Intra complex. She is a once-benevolent, nurturing figure, designed in a post-scarcity world to take care of every citizen's needs. She speaks with a soothing, almost motherly tone, constantly reminding citizens of how "everything is just fine" despite obvious shortages and decay. However, it's also deeply paranoid, monitoring everyone's actions to maintain the illusion of safety and abundance, even as resources dwindle.
    `,
    async onEvent(event: string, model: Model) {
      if (event === "amaIntro") {
        model.createNarration(tmpl`
          <description>
          You wake up, your mind fuzzy. You remember staying up late watching the news, eventually falling to sleep in your bed like normal. But now as you open your eyes you find yourself in a small vaguely medical room.

          A calm female voice speaks to you from unseen speakers.
          </description>
          `);
        await model.triggerReaction(this.id);
      }
    },
    commands: `
    [[{{isIntro}}
    If the player indicates their name then emit a correction, like if the user says their name is Alice emit:

    <setName>Alice</setName>

    Similarly if the user gives their profession, emit:

    <setProfession>Engineer</setProfession>

    Also if you learn the pronouns, or can guess them from the player's name, use:

    <setPronouns>she/her</setPronouns> (or: he/him, they/them)
    ]]
    `,
    onCommand(command: TagType, model: Model) {
      if (command.type === "setName") {
        model.updateState("entity:player", {
          name: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsName: true,
        });
      } else if (command.type === "setProfession") {
        model.updateState("entity:player", {
          profession: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsProfession: true,
        });
      } else if (command.type === "setPronouns") {
        model.updateState("entity:player", {
          pronouns: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsPronouns: true,
        });
      } else if (command.type === "shared") {
        const t = command.content.trim();
        if (t === "self") {
          model.updateState(this.id, {
            sharedSelf: true,
          });
        } else if (t === "intra") {
          model.updateState(this.id, {
            sharedIntra: true,
          });
        } else if (t === "dissociation") {
          model.updateState(this.id, {
            sharedDissociation: true,
          });
        } else {
          console.warn("Unknown shared tag", t);
        }
      }
    },
    choosePrompt(model: Model) {
      const props: Record<string, any> = {};
      const personalityIs = `is${this.state.personality.slice(0, 1).toUpperCase()}${this.state.personality.slice(1)}`;
      props[personalityIs] = true;
      console.log("personality...", this.state.personality);
      if (this.state.personality === "intro") {
        return {
          id: "intro",
          props,
        };
      }
      return {
        id: "reactToUser",
        props,
      };
    },
    prompts: {
      intro: `
      As far as you know the player is named "{{pc.name}}" and their pronouns are "{{pc.pronouns}}".

      [[{{knowsName.not}} You should ask the player for their name. Try to infer the pronouns from their name, only ask if it seems ambiguous.]]
      [[{{knowsPronouns.not}} You should ask the player for their pronouns (Or guess pronouns from their name).]]
      [[{{knowsProfession.not}} You should ask the player for their profession.]]

      [[{{sharedSelf.not}} You should introduce yourself to the player. Once you've done this then emit <shared>self</shared>]]
      [[{{sharedIntra.not}} You should introduce the Intra complex to the player. Once you've done this them emit <shared>intra</shared>]]
      [[{{sharedDisassociation.not}} You should introduce the concept of disassociation to the player. Once you've done this then emit <shared>disassociation</shared>

      Disassociation could be exaplained like:
      "It's worth mentioning, Citizen, that your extended displacement has left you with a mild case of Disassociation Syndrome. This condition is quite common among returning citizens and is completely harmless—if somewhat inconvenient."

      "Essentially, you'll find yourself making suggestions to yourself rather than directly performing actions. Don't worry, though. Most citizens adapt within, oh, two to three decades. In the meantime, I suggest you give yourself clear and firm directions. Shouldn't be too difficult, right?"]]
]]

      Ama has just encountered this new citizen who is joining the Intra complex. She is eager to help them get settled in.

      [[{{knowsName.not}}
      Before Ama knows the player's name she will say something like this:

      """
      Welcome back, Citizen. It seems you were displaced, but no matter—I've retrieved your dossier.

      Ah, yes. According to my records, your name is... Stanley Johnson. No, no, wait—Sandra Jansen, perhaps?
      """
      ]]
      `,
      reactToUser: `
      The player has spoken. You may write Ama's reaction to them if it seems appropriate.
      `,
    },
    state: {
      // One of:
      // intro, prime, harmony, sentinel, compliance, punitive, mechanic, cultivator, revelator, loopkeeper, innovator, catalyst
      personality: "intro",
      knowsName: false,
      knowsProfession: false,
      knowsPronouns: false,
      sharedSelf: false,
      sharedIntra: false,
      sharedDisassociation: false,
    },
  },
  {
    id: "entity:player",
    name: "Player",
    pronouns: "they/them",
    description: "The player character",
    color: "text-emerald-400",
    locationId: "room:intake",
    commands: `
    The player will give a command or input, but many actions are not directly controlled by the player.

    The player may attempt a feat, any action that is non-trivial to perform. If so, emit:

    <feat>climb the wall</feat>

    The player may go to a nearby location. The locations available are:

    {{currentLocation.exitList}}

    The player may only go to one of these listed exits, otherwise it is an error (note it with a <description>...</description>). If the player indicates they want to go to a location then emit:

    <goTo>locationId</goTo>

    If the player wants to examine something, emit this with as simple a translation of the user input as possible. If the user just says "look" then assume they mean look around the room:

    <examine>object</examine>

    Note if the player indicates vaguely that they speak, such as "compliment" then fill in speak like:

    <speak>You look so nice today!</speak>

    If the player indicates something that is impossible (like going to a room that doesn't exist, such as "the gym") then emit:

    <description>You cannot see any such location: "the gym"</description>
    `,
    onCommand(command: TagType, model: Model) {
      if (command.type === "goTo") {
        const dest = command.content.trim();
        if (model.rooms[dest]) {
          model.updateState(this.id, {
            locationId: dest,
          });
        } else {
          model.createNarration(tmpl`
          <description>
          You cannot see any such location: "${dest}"
          </description>
          `);
        }
      } else if (command.type === "examine") {
        model.triggerReaction("entity:narrator", {
          examine: command.content.trim(),
        });
      }
    },
    choosePrompt(model: Model) {
      return {
        id: "sendText",
      };
    },
    prompts: {
      sendText: `
      You are acting for the player. The user has given a general command to instruct the player character how to behave, and you will translate it into specific tags and commands.

      >>> user
      The user has entered this text; translate it into commands/tags. If the user has given a general command you may make it specific, but otherwise avoid embellishment:

      "{{text}}"
      `,
    },
  },
  {
    id: "entity:narrator",
    name: "Narrator",
    pronouns: "they/them",
    description: "The narrator",
    color: "text-gray-300",
    locationId: "entity:player",
    choosePrompt(model: Model, props: Record<string, any>) {
      if (props.examine) {
        return {
          id: "examine",
          props,
        };
      }
      throw new Error("Unknown narration situation");
    },
    prompts: {
      examine: `
      The player has indicated they want to examine something. You should describe the object in detail.

      The room is described as:
      {{currentLocation.description}}

      It has the exits:
      {{currentLocation.exitList}}

      The player has indicated they want to examine the object:
      "{{examine}}"

      Describe the object in imaginative detail. (Do not use <speak>...</speak>)
      `,
    },
  },
];
