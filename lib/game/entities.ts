import type { Model } from "../model";
import type { TagType } from "../parsetags";
import { tmpl } from "../template";
import type { EntityType } from "../types";

export const entities: EntityType[] = [
  {
    id: "entity:ama",
    name: "Ama",
    description: tmpl`
    Ama is in control of the entire Intra complex. She is a once-benevolent, nurturing figure, designed in a post-scarcity world to take care of every citizen's needs. She speaks with a soothing, almost motherly tone, constantly reminding citizens of how "everything is just fine" despite obvious shortages and decay. However, it's also deeply paranoid, monitoring everyone's actions to maintain the illusion of safety and abundance, even as resources dwindle.
    `,
    async onEvent(event: string, model: Model) {
      if (event === "amaIntro") {
        await model.triggerPrompt(this.id, this.prompts!.introPrompt);
      }
    },
    commands: tmpl`
    If the player indicates their name then emit a correction, like if the user says their name is Alice emit:

    <setName>Alice</setName>

    Similarly if the user gives their profession, emit:

    <setProfession>Engineer</setProfession>
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
      }
    },
    color: "bg-blue-800",
    prompts: {
      introPrompt: tmpl`
      Ama has just encountered this new citizen who is joining the Intra complex. She is eager to help them get settled in.

      Ama will say something like this:

      """
      Welcome back, Citizen. It seems you were displaced, but no matter—I've retrieved your dossier.

      Ah, yes. According to my records, your name is... Stanley Johnson. No, no, wait—Sandra Jansen, perhaps?
      """
      `,
    },
    state: {},
  },
  {
    id: "entity:player",
    name: "Player",
    description: "The player character",
    color: "bg-black",
    state: {},
  },
];
