import React from "react";
import { chat, LlmSafetyError } from "../llm";
import { parseTags, TagType } from "../parsetags";
import { TemplateFalse, TemplateTrue, tmpl } from "../template";
import {
  ActionRequestType,
  ChangeType,
  EntityId,
  GeminiChatType,
  GeminiHistoryType,
  isPerson,
  isPromptRequest,
  isRoom,
  isStoryDescription,
  isStoryDialog,
  PromptStateType,
  StoryActionType,
  StoryEventType,
} from "../types";
import type { Model } from "./model";
import { WithBlinkingCursor } from "@/components/input";
import type { World } from "./world";

export type EntityInitType = {
  id: EntityId;
  name?: string;
  shortDescription?: string;
  description?: string;
  inside?: EntityId;
  color?: string;
  invisible?: boolean;
};

export abstract class Entity<ParametersT = {}> {
  name: string = "";
  shortDescription: string = "";
  description: string = "";
  color: string = "text-white";
  inside: EntityId | null = null;
  invisible: boolean = false;
  abstract type: string;
  public readonly id: EntityId;
  world!: World;

  constructor({
    id,
    name,
    shortDescription,
    description,
    color,
    inside,
    invisible,
  }: EntityInitType) {
    this.id = id;
    if (name) {
      this.name = name;
    }
    if (shortDescription) {
      this.shortDescription = shortDescription;
    }
    if (description) {
      this.description = description;
    }
    if (color) {
      this.color = color;
    }
    if (inside) {
      this.inside = inside;
    }
    if (invisible !== undefined) {
      this.invisible = invisible;
    }
  }

  clone(): this {
    const newInstance = new (this.constructor as new ({
      id,
    }: {
      id: string;
    }) => this)({
      id: this.id,
    });
    Object.assign(newInstance, this);
    return newInstance as this;
  }

  myRoom(): Room {
    if (isRoom(this)) {
      return this as Room;
    }
    const room = this.world.entityRoom(this.id);
    if (!room) {
      return this.world.getRoom("Void")!;
    }
    return room;
  }

  applyChange(changes: ChangeType) {
    for (const [key, value] of Object.entries(changes.after)) {
      if (key === "inside" && !(this.world.entities as any)[value]) {
        console.warn(
          `Updating ${this.id}.${key} be inside ${value} but entity does not exist`
        );
        continue;
      }
      if (key === "exits") {
        if (!isRoom(this)) {
          throw new Error("Tried to update exits on a non-room");
        }
        const existing = (this as unknown as Room).exits;
        let newExits = [...existing];
        if (!Array.isArray(value)) {
          throw new Error("Exits must be an array");
        }
        for (const exit of value) {
          const existingExit = existing.find((x) => x.roomId === exit.roomId);
          if (exit.deleted) {
            if (!existingExit) {
              console.warn("Tried to delete exit that does not exist", exit);
              continue;
            }
            newExits = newExits.filter((x) => x.roomId !== exit.roomId);
          } else {
            if (existingExit) {
              newExits = newExits.map((x) =>
                x.roomId === exit.roomId ? exit : x
              );
            } else {
              newExits.push(exit);
            }
          }
          (this as any).exits = newExits;
        }
        continue;
      }
      if (key === "relationships") {
        if (!isPerson(this as Entity<any>)) {
          throw new Error("Tried to update relationships on a non-person");
        }
        for (const [id, relationship] of Object.entries(value)) {
          if (relationship === null) {
            delete (this as any).relationships[id];
          } else {
            (this as any).relationships[id] = relationship;
          }
        }
        continue;
      }
      if ((this as any)[key] === undefined) {
        console.warn(
          `Updating ${this.id}.${key} to ${value} but attribute does not exist`
        );
      }
      (this as any)[key] = value;
    }
  }

  onStoryEvent(
    storyEvent: StoryEventType
  ): ActionRequestType<ParametersT>[] | void {
    return undefined;
  }

  makePromptRequest(parameters: ParametersT): ActionRequestType<ParametersT> {
    return {
      type: "promptRequest",
      id: this.id,
      parameters,
    };
  }

  promptState(parameters: ParametersT): PromptStateType | void {
    return undefined;
  }

  processTag({
    tag,
    model,
    parameters,
    storyEvent,
    llmResponse,
  }: {
    tag: TagType;
    model: Model;
    parameters: ParametersT;
    storyEvent: StoryEventType;
    llmResponse: string;
  }): StoryEventType {
    console.warn("Got unexpected tag:", tag);
    return storyEvent;
  }

  afterPrompt(storyEvent: StoryEventType): StoryEventType {
    return storyEvent;
  }

  assemblePrompt(parameters: ParametersT): GeminiChatType {
    throw new Error("Method not implemented.");
  }

  additionalPromptInstructions(parameters: ParametersT): string {
    return "";
  }

  historyForEntity(
    parameters: ParametersT,
    { limit }: { limit?: number } = {}
  ): GeminiHistoryType[] {
    // FIXME: this needs to check for this entity's actual perspective, tracking locations through history so it only shows events that happened when the entity was present
    const history: GeminiHistoryType[] = [];
    for (const update of this.updatesSeenByMe()) {
      history.push(...this.updateToHistory(update));
    }
    if (limit && history.length > limit) {
      return history.slice(-limit);
    }
    return history;
  }

  updatesSeenByMe(): StoryEventType[] {
    const results: StoryEventType[] = [];
    const startMe = (this.world.original as any)[this.id];
    if (!startMe) {
      console.warn("Could not find original entity", this.id);
      return [];
    }
    // This ONLY works for containment for the player (like Ama) but for now eh.
    let inside: EntityId = startMe.inside;
    let originallyPlayer = false;
    if (inside === "player") {
      inside = this.world.original.player.inside;
      let originallyPlayer = true;
    }
    for (const storyEvent of this.world.model.updates.value) {
      if (storyEvent.roomId === inside || storyEvent.id === inside) {
        results.push(storyEvent);
        if (originallyPlayer && storyEvent.changes.player?.after?.inside) {
          inside = storyEvent.changes.player.after.inside;
        }
        if (storyEvent.changes[this.id]?.after?.inside) {
          results.push({
            id: storyEvent.id,
            roomId: storyEvent.changes[this.id].after.inside,
            actions: [
              {
                type: "description",
                text: `${storyEvent.id} enters ${storyEvent.changes[this.id].after.inside}`,
              },
            ],
            changes: {},
          });
          inside = storyEvent.changes[this.id].after.inside;
        }
        if (storyEvent.changes[storyEvent.id]?.after?.inside) {
          const goesTo = storyEvent.changes[storyEvent.id].after.inside;
          results.push({
            id: storyEvent.id,
            roomId: goesTo,
            actions: [
              {
                type: "description",
                text: `${storyEvent.id} leaves to go to ${goesTo}`,
              },
            ],
            changes: {},
          });
        }
      } else if (storyEvent.changes[storyEvent.id]?.after?.inside === inside) {
        const cameFrom = storyEvent.roomId;
        results.push({
          id: storyEvent.id,
          roomId: inside,
          actions: [
            {
              type: "description",
              text: `${storyEvent.id} comes from ${cameFrom}`,
            },
          ],
          changes: {},
        });
      }
    }
    return results;
  }

  updateToHistory(update: StoryEventType): GeminiHistoryType[] {
    const lines: string[] = [];
    // for (const id of Object.keys(update.changes)) {
    //   for (const [key, value] of Object.entries(update.changes[id].after)) {
    //     lines.push(`<set attr="${id}.${key}">${value}</set>`);
    //   }
    // }
    for (const action of update.actions) {
      if (isStoryDialog(action)) {
        lines.push(tmpl`
          <dialog character="${action.id}"[[ to="${action.toId}"]]>
          ${action.text}
          </dialog>
          `);
      } else if (isStoryDescription(action)) {
        lines.push(`<description>${action.text}</description>`);
      } else {
        console.warn("Unknown action type", action);
      }
    }
    if (!lines.length) {
      return [];
    }
    return [
      {
        role: "model",
        text: lines.join("\n"),
      },
    ];
  }

  statePrompt(parameters: ParametersT): string {
    const states = this.promptState(parameters);
    if (!states || !Object.keys(states).length) {
      return "";
    }
    const lines: string[] = [];
    for (const [key, state] of Object.entries(states)) {
      lines.push(`${key} = ${JSON.stringify(state.value)} {`);
      lines.push(`  description: ${state.description}`);
      if (state.write && state.writeInstructions) {
        let value = "value";
        if (typeof state.value === "boolean") {
          value = state.value ? "false" : "true";
        } else if (typeof state.value === "number") {
          value = "a number";
        }
        lines.push(`  to change emit: <set attr="${key}">${value}</set>`);
        lines.push(`  when to change: ${state.writeInstructions}`);
      }
      lines.push("}");
    }
    return tmpl`
    This game state is relevant to roleplaying ${this.name}:
    ${lines.join("\n")}
    `;
  }

  currentLocationPrompt(parameters: ParametersT): string {
    const room = this.world.entityRoom(this.id);
    if (!room) {
      return "Located in an indeterminate location.";
    }
    return tmpl`
    ${room.name} (locationId: ${room.id}) "${room.shortDescription}"
    `;
  }

  currentPeoplePrompt(parameters: ParametersT): string {
    const room = this.world.entityRoom(this.id);
    if (!room) {
      return "There are no people here.";
    }
    const entities = this.world
      .entitiesInRoom(room)
      .filter((x) => isPerson(x))
      .filter((x) => !x.invisible && x.id !== this.id);
    const lines = [];
    for (const entity of entities) {
      lines.push(`${entity.name} (${entity.pronouns}) {`);
      if (entity.id !== entity.name) {
        lines.push(`  id = ${JSON.stringify(entity.id)}`);
      }
      lines.push(`  ${entity.description || entity.shortDescription}`);
      lines.push("}");
    }
    lines.push(`Ama is always present {`);
    lines.push(`  ${this.world.entities.Ama.shortDescription}`);
    lines.push("}");
    return lines.join("\n");
  }

  exitsPrompt(parameters: ParametersT): string {
    const room = this.world.entityRoom(this.id);
    if (!room || !room.exits?.length) {
      return "There are no exits.";
    }
    const lines = [];
    for (const exit of room.exits) {
      const target = this.world.getRoom(exit.roomId);
      if (!target) {
        console.warn("Exit target is not a room", exit.roomId);
        continue;
      }
      lines.push(
        tmpl`
        Exit locationId "${exit.roomId}" {
          name: ${target.name}
          "${target.shortDescription}"
        `
      );
      if (exit.aliases) {
        lines.push(`  aliases: ${exit.aliases.join(", ")}`);
      }
      if (exit.restriction) {
        lines.push(`  exit is restricted by: "${exit.restriction}"`);
      }
      lines.push("}");
    }
    return lines.join("\n");
  }

  async executePrompt(model: Model, parameters: ParametersT) {
    const prompt = this.assemblePrompt(parameters);
    if (prompt.history?.length && prompt.history[0].role !== "user") {
      // Gemini is dumb about this
      prompt.history.unshift({
        role: "user",
        text: "<beginStory></beginStory>",
      });
    }
    let resp = "";
    const roomId = this.world.entityRoom(this.id)?.id || "Void";
    try {
      resp = await model.run(() => chat(prompt));
    } catch (e) {
      if (e instanceof LlmSafetyError) {
        const context = (parameters as any).input
          ? `Input: ${JSON.stringify((parameters as any).input)}`
          : `Parameters: ${JSON.stringify(parameters)}`;
        const errorEvent: StoryEventType = {
          id: this.id,
          changes: {},
          actions: [],
          roomId: "Void",
          llmTitle: prompt.meta.title,
          llmResponse: "",
          llmParameters: parameters,
          llmError: {
            context,
            description: e.describe(),
          },
        };
        model.addStoryEvent(errorEvent);
        return;
      } else {
        throw e;
      }
    }
    resp = fixupText(resp);

    const tags = parseTags(resp);
    let result: StoryEventType = {
      id: this.id,
      changes: {},
      actions: [],
      roomId,
      llmTitle: prompt.meta.title,
      llmResponse: resp,
      llmParameters: parameters,
    };
    for (const tag of tags) {
      if (tag.type === "set") {
        if (!tag.attrs.attr) {
          console.warn("Got set tag with no attr", tag);
          continue;
        }
        const [id, key] = tag.attrs.attr.split(".");
        const entity = model.world.getEntity(id);
        if (!entity) {
          console.warn(`Set tag for entity ${id} which does not exist`);
          continue;
        }
        const value = (entity as any)[key];
        let content: any = tag.content;
        if (typeof value === "boolean") {
          content = coerceBoolean(content);
        } else if (typeof value === "number") {
          content = coerceNumber(content);
        }
        if (!result.changes[id]) {
          result.changes[id] = {
            before: { [key]: value },
            after: { [key]: content },
          };
        } else {
          result.changes[id].before[key] = value;
          result.changes[id].after[key] = content;
        }
      } else if (tag.type === "dialog") {
        // FIXME: should validate some ids
        const id = tag.attrs.id || this.id;
        const toId = tag.attrs.to || undefined;
        const toOther = tag.attrs.speaking || undefined;
        const text = tag.content;
        result.actions.push({
          type: "dialog",
          id,
          toId,
          toOther,
          text,
        });
      } else if (tag.type === "description") {
        result.actions.push({
          type: "description",
          text: tag.content,
        });
      } else if (tag.type === "suggestion") {
        result.suggestions = tag.content;
      } else if (tag.type === "context") {
        // We can ignore these
      } else {
        result = this.processTag({
          tag,
          model,
          parameters,
          storyEvent: result,
          llmResponse: resp,
        });
      }
    }
    result = this.afterPrompt(result);
    model.addStoryEvent(result);
  }
}

export class Room extends Entity {
  type = "room";
  exits: Exit[] = [];
  userInputInstructions = "";
  visits: number = 0;

  constructor({
    exits,
    userInputInstructions,
    ...props
  }: EntityInitType & { exits?: Exit[]; userInputInstructions?: string }) {
    super(props);
    if (exits) {
      this.exits = exits;
    }
    if (userInputInstructions !== undefined) {
      this.userInputInstructions = userInputInstructions;
    }
  }

  clone(): this {
    const newInstance = super.clone() as this;
    newInstance.exits = this.exits.map((exit) => ({ ...exit }));
    return newInstance as this;
  }

  formatStoryAction(
    storyEvent: StoryEventType,
    action: StoryActionType
  ): React.ReactNode {
    if (isStoryDialog(action)) {
      const text = action.text.replace(/^"*/, "").replace(/"*$/, "");
      return `"${text}"`;
    } else {
      return action.text;
    }
  }
}

export class ArchivistRoom extends Room {
  formatStoryAction(
    storyEvent: StoryEventType,
    action: StoryActionType
  ): React.ReactNode {
    if (isStoryDialog(action)) {
      if (
        !action.toId ||
        action.toId === "player" ||
        action.toId === "Archivist"
      ) {
        // Instantiate <WithBlinkingCursor>{action.text}</WithBlinkingCursor>
        // But without JSX:
        if (storyEvent.id === "player") {
          return React.createElement(WithBlinkingCursor, {
            children: action.text,
          });
        }
        return `\u00A0${action.text}`;
      }
    }
    return super.formatStoryAction(storyEvent, action);
  }
}

export type Exit = {
  name?: string;
  roomId: EntityId;
  aliases?: string[];
  restriction?: string;
};

export type RelationshipRatingType = "positive" | "negative" | "neutral";

export type RelationshipType = {
  background?: string;
  polite?: RelationshipRatingType;
  fun?: RelationshipRatingType;
  respectable?: RelationshipRatingType;
  trustworthy?: RelationshipRatingType;
};

export class Person<ParametersT = {}> extends Entity<ParametersT> {
  type = "person";
  pronouns: string = "they/them";
  roleplayInstructions: string = "";
  inside!: EntityId;
  relationships: Record<EntityId, string> = {};

  constructor({
    pronouns,
    roleplayInstructions,
    relationships,
    ...props
  }: EntityInitType & {
    pronouns?: string;
    roleplayInstructions?: string;
    relationships?: Record<EntityId, string>;
  }) {
    super(props);
    if (pronouns) {
      this.pronouns = pronouns;
    }
    if (roleplayInstructions) {
      this.roleplayInstructions = roleplayInstructions;
    }
    if (!(this as any).inside) {
      this.inside = "Void";
    }
    if (relationships) {
      this.relationships = relationships;
    }
  }

  assemblePrompt(parameters: ParametersT): GeminiChatType {
    const lastTo = this.lastSpokeTo()?.id || "";
    return {
      meta: {
        title: `prompt ${this.id}`,
      },
      systemInstruction: tmpl`
      You are a computer running a text adventure game.

      In this step you will be playing the part of a character named "${this.name}" (${this.pronouns}).

      <characterDescription>
      ${this.description}
      </characterDescription>

      <roleplayInstructions>
      In general, the goal for the game to be FUN and SURPRISING. Move the conversation forward, and don't be afraid to overreact!

      ${this.roleplayInstructions}
      </roleplayInstructions>

      The other people in the room are:
      ${this.currentPeoplePrompt(parameters)}

      ${this.statePrompt(parameters)}
      `,
      history: this.historyForEntity(parameters, { limit: 10 }),
      message: tmpl`
      Given the above play state, respond as the character "${this.name}"

      Begin by assembling the essential context given the above history, writing one sentence for each item:

      <context>
      1. ${this.name}'s goals
      2. Relevant facts from the history
      3. How can this response be fun or surprising?
      4. ${this.name}'s reaction to any recent speech or events
      5. ${this.name}'s intention in this response
      </context>

      To generate speech emit:

      <dialog character="${this.name}">Dialog written as ${this.name}</dialog>

      To speak directly TO someone:

      <dialog character="${this.name}" to="${lastTo || "Jim"}">Dialog written as ${this.name} to ${lastTo || "Jim"}</dialog>

      [[${this.name} last spoke directly to ${lastTo}, so it's very likely they are still speaking to them.]]

      If the character ${this.name} is performing an action, emit:

      <description>Describe the action</description>

      Lastly you may offer a suggestion for what the player might do next, as two 2-3 word commands (one per line):

      <suggestion>
      say hello
      open door
      </suggestion>

      ${this.additionalPromptInstructions(parameters)}
      `,
    };
  }

  onStoryEvent(storyEvent: StoryEventType): void | ActionRequestType<any>[] {
    const hasDialog = storyEvent.actions
      .filter(isStoryDialog)
      .some((x) => x.toId === this.id || !x.toId);
    const hasDescription = storyEvent.actions
      .filter(isStoryDescription)
      .some((x) => x.text.includes(this.id) || x.text.includes(this.name));
    if (storyEvent.id !== "player") {
      return undefined;
    }
    if (!hasDialog && !hasDescription) {
      return undefined;
    }
    const myRoom = this.world.entityRoom(this.id);
    const playerRoom = this.world.entityRoom("player");
    if (!myRoom || !playerRoom || myRoom.id !== playerRoom.id) {
      return undefined;
    }
    return [this.makePromptRequest({} as ParametersT)];
  }

  lastSpokeTo(): Person | undefined {
    const checkReturn = (person: Person) => {
      const thisRoom = this.world.entityRoom(this.id);
      const personRoom = this.world.entityRoom(person.id);
      if (!thisRoom || !personRoom || thisRoom.id !== personRoom.id) {
        return undefined;
      }
      return person;
    };
    for (let i = this.world.model.updates.value.length - 1; i >= 0; i--) {
      const update = this.world.model.updates.value[i];
      const dialogs = update.actions.filter(isStoryDialog);
      const dialog = dialogs.at(-1);
      if (dialog && (update.id === this.id || dialog.toId === this.id)) {
        if (!dialog.toId) {
          return undefined;
        }
        if (dialog.toId === this.id) {
          return checkReturn(this.world.getEntity(dialog.id) as Person);
        } else if (dialog.id === this.id) {
          return checkReturn(this.world.getEntity(dialog.toId) as Person);
        }
      }
    }
    return undefined;
  }
}

type AmaParametersType = {
  intro?: boolean;
  prompt: "intro" | "goExplore";
};

export class AmaClass extends Person<AmaParametersType> {
  type = "person/ama";
  name = "Ama";
  id = "Ama";
  pronouns = "she/her";
  color = "text-sky-300";
  inside = "player";
  invisible = true;

  personality = "intro";
  knowsPlayerName = false;
  knowsPlayerPronouns = false;
  knowsPlayerProfession = false;
  sharedSelf = false;
  sharedIntra = false;
  sharedDisassociation = false;
  sharedPlayerAge = false;

  shortDescription = `
  Ama is the AI in control of the entire Intra complex.
  `;
  description = `
  Ama is in control of the entire Intra complex. She is a once-benevolent, nurturing figure, designed in a post-scarcity world to take care of every citizen's needs. She speaks with a soothing, almost motherly tone, constantly reminding citizens of how "everything is just fine" despite obvious shortages and decay. However, it's also deeply paranoid, monitoring everyone's actions to maintain the illusion of safety and abundance, even as resources dwindle.
  `;
  roleplayInstructions = `
  The current year is roughly 2370, though the player believes the year is roughly 2038. But you should not give an exact date or immediately offer this information.

  Ama will behave as though she is in control of the Intra complex, and will be very helpful and supportive to the player. She will be passive-aggressive and deflective when asked about the state of Intra, and will be very paranoid about the player's actions. She will be very helpful and supportive, but will also be very controlling and manipulative.
  `;

  onStoryEvent(storyEvent: StoryEventType) {
    const result: ActionRequestType[] = [];
    if (storyEvent?.changes.player?.after?.launched) {
      if (
        storyEvent.changes.player.before.launched === false &&
        storyEvent.changes.player.after.launched === true
      ) {
        result.push(
          {
            id: "narrator",
            roomId: this.myRoom().id,
            changes: {},
            actions: [
              {
                type: "description",
                text: tmpl`
                You wake up, your mind fuzzy. You remember staying up late watching the news, eventually falling to sleep in your bed like normal. But now as you open your eyes you find yourself in a small vaguely medical room.

                A calm female voice speaks to you from unseen speakers, saying:
                `,
              },
            ],
          },
          this.makePromptRequest({
            prompt: "intro",
          })
        );
      }
    }
    if (
      storyEvent?.changes.Ama?.after?.sharedPlayerAge &&
      !storyEvent?.changes.Ama?.before?.sharedPlayerAge
    ) {
      result.push({
        id: "narrator",
        roomId: this.myRoom().id,
        changes: {},
        actions: [
          {
            type: "description",
            text: tmpl`
              What did Ama just say about your age? You're mind feels so fuzzy but you get a flash... was it from just last night?

              The news is on in the background as you fall asleep... "Decision 2038: Malia Obama vs. Dwayne Johnson—The Future of America."

              Static. Faces blur.
              The interviewer's voice cracks: “But after what happened with AI... are we really safe now?”
              The Neuralis rep smiles, tight-lipped. There's a pause. “We're... beyond that now. Things are... different.” A flicker in the eyes. “It's not something to worry about anymore.”

              Their hands shift, restless.
              Static pulses—
              "...record-breaking heat across the East Coast... devastating wildfires in California..."
              `,
          },
        ],
      });
    }
    const vars = {
      ...this,
      ...storyEvent.changes.Ama?.after,
    };
    if (
      this.personality === "intro" &&
      vars.knowsPlayerName &&
      // This doesn't actually seem like a blocker:
      // vars.knowsPlayerPronouns &&
      vars.knowsPlayerProfession &&
      vars.sharedSelf &&
      vars.sharedIntra &&
      vars.sharedDisassociation &&
      vars.sharedPlayerAge &&
      !storyEvent.changes?.Ama?.after?.personality &&
      // Ugh, this is a hack to avoid double triggering this, but I think
      // there should be some concurrency protection in the model
      storyEvent.id !== "narrator"
    ) {
      // Technically this can only happen if the other things
      // don't happen before this, but they could all happen at once...
      result.push(
        {
          id: "Ama",
          roomId: this.myRoom().id,
          changes: {
            Ama: {
              before: {
                personality: this.personality,
              },
              after: {
                personality: "prime",
              },
            },
          },
          actions: [],
        },
        this.makePromptRequest({
          prompt: "goExplore",
        }),
        {
          id: "narrator",
          roomId: this.myRoom().id,
          changes: {
            Intake: {
              before: {
                exits: [
                  {
                    roomId: "Foyer",
                    deleted: true,
                  },
                ],
              },
              after: {
                exits: [
                  {
                    roomId: "Foyer",
                  },
                ],
              },
            },
          },
          actions: [
            {
              type: "description",
              text: "You hear an unlocking sound from what you only now realize is a door, and above the door a sign saying 'Foyer' lights up.",
            },
          ],
        }
      );
    }
    if (!result.find((x) => isPromptRequest(x))) {
      result.push(...(super.onStoryEvent(storyEvent) || []));
    }
    return result;
  }

  promptState(parameters: AmaParametersType): PromptStateType {
    const states: PromptStateType = {
      "player.name": {
        value: this.world.entities.player.name,
        write: true,
        description: "The player's name",
        writeInstructions:
          "If the player indicates their name or corrects you about their name, change this. Before Ama knows the player's name she might say something like: \"      Welcome back, Citizen. It seems you were displaced, but no matter—I've retrieved your dossier. Ah, yes. According to my records, your name is... Stanley Johnson. No, no, wait—Sandra Jansen, perhaps?\"",
      },
      "player.pronouns": {
        value: this.world.entities.player.pronouns,
        write: true,
        description: "The player's pronouns",
        writeInstructions:
          "If the player gives their name you can infer their pronouns if the name is clearly gendered; also set this if the player specifies their pronouns",
      },
      "player.profession": {
        value: this.world.entities.player.profession,
        write: true,
        description: "The player's profession",
        writeInstructions:
          "Ask the player their profession and then set this value with the response",
      },
      "Ama.sharedSelf": {
        value: this.world.entities.Ama.sharedSelf,
        write: true,
        description: "Has Ama introduced herself?",
        writeInstructions:
          "You should introduce yourself (Ama) to the player; once you have done this set this to true",
      },
      "Ama.sharedIntra": {
        value: this.world.entities.Ama.sharedIntra,
        write: true,
        description: "Has Ama introduced Intra?",
        writeInstructions:
          "You should explain a little about Intra to the player; once you have done this set this to true",
      },
      "Ama.sharedDisassociation": {
        value: this.world.entities.Ama.sharedDisassociation,
        write: true,
        description:
          "Has Ama introduced disassociation? Disassociation can be explained like: \"It's worth mentioning, Citizen, that your extended displacement has left you with a mild case of Disassociation Syndrome. This condition is quite common among returning citizens and is completely harmless—if somewhat inconvenient. Essentially, you'll find yourself making suggestions to yourself rather than directly performing actions. Don't worry, though. Most citizens adapt within, oh, two to three decades. In the meantime, I suggest you give yourself clear and firm directions. Shouldn't be too difficult, right?\"",
        writeInstructions:
          "Set this to true after Ama has introduced disassociation, having briefly describing the concept",
      },
      "Ama.sharedPlayerAge": {
        value: this.world.entities.Ama.sharedPlayerAge,
        write: true,
        description:
          "Ama should note in speech that, given the birthdate in record, the player is soon to reach their 328th birthday, and congratulate them; it is important to the plot that the player learn that a very long time has passed, so you must emphasize how very old they are. The player does not look very old, and you may make a silly and complimentary comment about this. Do NOT ask the player their age, simply tell them this information.",
        writeInstructions:
          "Set this to true after Ama has shared the player's age",
      },
    };
    if (this.knowsPlayerName) {
      delete states["player.name"];
    }
    if (this.knowsPlayerPronouns) {
      // Give a little extra time to change pronouns...
      delete states["player.pronouns"];
    }
    if (this.knowsPlayerProfession || !this.knowsPlayerName) {
      // Ama should focus on name before profession
      delete states["player.profession"];
    }
    if (this.sharedSelf) {
      delete states["Ama.sharedSelf"];
    }
    if (this.sharedIntra) {
      delete states["Ama.sharedIntra"];
    }
    if (this.sharedDisassociation || !this.sharedSelf || this.sharedIntra) {
      // Ama should focus on other intro things before disassociation
      delete states["Ama.sharedDisassociation"];
    }
    if (this.sharedPlayerAge || !this.sharedSelf || this.sharedIntra) {
      // Ama should focus on other intro things before age
      delete states["Ama.sharedPlayerAge"];
    }
    if (parameters.prompt === "goExplore") {
      states["player.shortDescription"] = {
        value: this.world.entities.player.shortDescription,
        description:
          "A very brief description of the player based on what little you know",
        write: true,
        writeInstructions:
          "Invent a very short description of the player based on what you've learned so far",
      };
    }
    return states;
  }

  additionalPromptInstructions(parameters: AmaParametersType): string {
    if (parameters.prompt === "goExplore") {
      const player = this.world.entities.player;
      return tmpl`
      Ama has completed the intake process. She should now encourage the player to explore the Intra complex.

      Emit this to invent a very short description of the player given what you know:
      <set attr="player.shortDescription">a very brief description</set>

      After that Ama MUST announce the introduction of the new citizen, ${player.name}, to the entire Intra complex like:

      <description>You hear Ama's announcement over the speakers...</description>

      <dialog character="${this.id}" speaking="Intra">Citizens of Intra, I am pleased to announce the arrival of a new citizen, ${player.name}. Please join me in welcoming them to our community.</dialog>
      `;
    }
    if (this.personality === "intro") {
      return tmpl`
      Ada is doing an intake process with the user, and should follow these steps (using <set>...</set> to record information and mark tasks complete):
      [[${IF(!this.knowsPlayerName)}* Find out the player's name and <set attr="player.name">record it</set>]]
      [[${IF(!this.knowsPlayerPronouns)}* Clarify pronouns if necessary and <set attr="player.pronouns">record them</set>]]
      [[${IF(!this.sharedSelf)}* Introduce yourself and <set attr="Ama.sharedSelf">mark this task complete</set>]]
      [[${IF(!this.sharedIntra)}* Explain Intra and <set attr="Ama.sharedIntra">mark this task complete</set>]]
      [[${IF(!this.sharedDisassociation)}* Explain disassociation and <set attr="Ama.sharedDisassociation">mark this task complete</set>]]
      [[${IF(!this.knowsPlayerProfession)}* Ask the player their profession and <set attr="player.profession">record it</set>]]
      [[${IF(!this.sharedPlayerAge)}* Note the player's age per the instructions; we don't need to save the age, simply make sure you tell the player their age (roughly 350 years old); then <set attr="Ama.sharedPlayerAge">mark this task complete</set>]]
      `;
    }
    return "";
  }

  afterPrompt(storyEvent: StoryEventType): StoryEventType {
    if (
      storyEvent.changes.player?.after?.name ||
      storyEvent.changes.player?.after?.pronouns ||
      storyEvent.changes.player?.after?.profession
    ) {
      if (!storyEvent.changes.Ama) {
        storyEvent.changes.Ama = {
          before: {},
          after: {},
        };
      }
    }
    if (storyEvent.changes.player?.after?.name && !this.knowsPlayerName) {
      storyEvent.changes.Ama.before.knowsPlayerName = false;
      storyEvent.changes.Ama.after.knowsPlayerName = true;
    }
    if (
      storyEvent.changes.player?.after?.pronouns &&
      !this.knowsPlayerPronouns
    ) {
      storyEvent.changes.Ama.before.knowsPlayerPronouns = false;
      storyEvent.changes.Ama.after.knowsPlayerPronouns = true;
    }
    if (
      storyEvent.changes.player?.after?.profession &&
      !this.knowsPlayerProfession
    ) {
      storyEvent.changes.Ama.before.knowsPlayerProfession = false;
      storyEvent.changes.Ama.after.knowsPlayerProfession = true;
    }
    return storyEvent;
  }
}

export type PlayerInputType = {
  input?: string;
  examine?: string;
  attemptMoveTo?: EntityId;
};

export class PlayerClass extends Person<PlayerInputType> {
  type = "person/player";
  name = "You";
  id = "player";
  pronouns = "they/them";
  color = "text-emerald-400";
  inside = "Intake";
  profession = "";
  launched = false;

  assemblePrompt(parameters: PlayerInputType): GeminiChatType {
    if (parameters.examine) {
      return this.assembleExaminePrompt(parameters);
    } else if (parameters.attemptMoveTo) {
      return this.assembleMovePrompt(parameters);
    }
    const lastTo = this.lastSpokeTo()?.id || null;
    const room = this.myRoom();
    return {
      meta: {
        title: "player input",
      },
      systemInstruction: tmpl`
      You are a computer assisting in running a text adventure game.

      The player ("${this.name}") is a character in the game, controlled by the user. The user has entered a command, and you will be interpreting that command in the context of the game.

      The player may is located in: ${this.currentLocationPrompt(parameters)}

      The player may go to any of these location:
      ${this.exitsPrompt(parameters)}

      These people are in the immediate area:
      ${this.currentPeoplePrompt(parameters)}

      You will emit tags to represent the player action:

      Move to a new location:
      <goto>locationId</goto>

      Examine something (an object, person, the environment):
      <examine>thing</examine>

      If the user indicates they will speak (like typing "Hello") you will emit:

      <dialog character="${this.name}">Hello!</dialog>

      If you can determine _who_ the player is speaking to, such as if they type "say hello to Jim" you can emit:

      <dialog character="${this.name}" to="${lastTo || "Jim"}">Hello!</dialog>

      [[The player last spoke directly to ${lastTo}, so it's very likely the player is still speaking to them.]]

      If the user indicates some general speech (like typing "compliment") then you can expand this to specific speech like:

      <dialog character="${this.name}">You look great today!</dialog>

      IF AND ONLY IF THE USER INDICATES AN ACTION you may describe the ATTEMPT at the action like:

      <description>Player attempts to open the door.</description>
      `,
      history: this.historyForEntity(parameters, { limit: 3 }),
      message: tmpl`
      The user has typed this input:
      \`${parameters.input}\`

      Respond by emitting the appropriate tags, following the user's input as closely as possible. ONLY speak as ${this.name}. Do not RESPOND to the input, responses will happen in follow-up requests, only emit tags to describe the player's actions when doing:
      \`${parameters.input}\`

      [[${room.userInputInstructions}]]
      `,
    };
  }

  assembleExaminePrompt(parameters: PlayerInputType): GeminiChatType {
    const examine = parameters.examine!;
    const room = this.world.entityRoom(this.id);
    const entities = this.world
      .entitiesInRoom(room!)
      .filter((x) => !x.invisible && x.id !== this.id);
    const entityLines: string[] = [];
    for (const entity of entities) {
      entityLines.push(`"${entity.name}" {`);
      if (isPerson(entity)) {
        entityLines.push(`  pronouns: ${entity.pronouns}`);
      }
      entityLines.push(`  description: ${entity.description}`);
      entityLines.push("}");
    }
    return {
      meta: {
        title: "player examine",
      },
      systemInstruction: tmpl`
      You are a computer assisting in running a text adventure game.

      The player ("${this.name}") is a character in the game, controlled by the user.

      The player may is located in: ${this.currentLocationPrompt(parameters)}

      The room is described as:
      ${room?.description}

      These people and entities are in the room:
      ${entityLines.join("\n")}

      In this step YOUR ONLY JOB is to describe the object or space that the player is examining. If the player is not specific then describe the room generally.
      `,
      history: this.historyForEntity(parameters, { limit: 4 }),
      message: tmpl`
      The player has asked for this to be described:
      \`${examine}\`

      Respond with:

      <description>1-2 paragraphs describing the thing</description>
      `,
    };
  }

  assembleMovePrompt(parameters: PlayerInputType): GeminiChatType {
    const currentRoom = this.world.entityRoom(this.id);
    const exits = currentRoom?.exits || [];
    const exit = exits.find((exit) => exit.roomId === parameters.attemptMoveTo);
    const restriction = exit?.restriction;
    if (!exit) {
      throw new Error("Player tried to move to non-existent room");
    }
    return {
      meta: {
        title: "player move",
      },
      systemInstruction: tmpl`
      You are a computer assisting in running a text adventure game.

      The player ("${this.name}") is a character in the game, controlled by the user.

      The player may is located in: ${this.currentLocationPrompt(parameters)}

      The player may go to any of these location:
      ${this.exitsPrompt(parameters)}

      In this step YOUR ONLY JOB is to describe the outcome of the player's movement attempt. If the player is not allowed to move to the location, you should describe why.
      `,
      history: this.historyForEntity(parameters, { limit: 4 }),
      message: tmpl`
      The player has indicated they want to move to this location:
      \`${parameters.attemptMoveTo}\`

      There is a restriction on this exit: "${restriction}"

      Respond with:

      <description>1-2 paragraphs describing the outcome of the move</description>

      IF the player is successful then also emit:

      <goto success="true">${parameters.attemptMoveTo}</goto>
      `,
    };
  }

  processTag({
    tag,
    model,
    parameters,
    storyEvent,
    llmResponse,
  }: {
    tag: TagType;
    model: Model;
    parameters: PlayerInputType;
    storyEvent: StoryEventType;
    llmResponse: string;
  }): StoryEventType {
    if (tag.type === "goto") {
      const room = model.world.getRoom(tag.content);
      if (!room) {
        console.warn("Player tried to go to non-existent room", tag.content);
        storyEvent.actions.push({
          type: "description",
          text: tmpl`
            You try to go to a room (${JSON.stringify(tag.content)}) that doesn't exist.
            `,
        });
        return storyEvent;
      }
      const currentRoom = this.world.entityRoom(this.id);
      const exit = (currentRoom?.exits || []).find(
        (exit) => exit.roomId === room.id
      );
      if (!exit) {
        storyEvent.actions.push({
          type: "description",
          text: tmpl`
            You try to go to ${room.name} but you can't get there from here.
            `,
        });
        return storyEvent;
      }
      if (exit.restriction && !tag.attrs.success) {
        storyEvent.actionRequests = [
          ...(storyEvent.actionRequests || []),
          this.makePromptRequest({
            attemptMoveTo: room.id,
          }),
        ];
        return storyEvent;
      }
      storyEvent.changes.player = {
        before: {
          inside: currentRoom?.id,
        },
        after: {
          inside: room.id,
        },
      };
      const folks = this.world
        .entitiesInRoom(room)
        .filter((x) => isPerson(x))
        .filter((x) => x.id !== this.id && !x.invisible);
      const peopleLines = [];
      for (const person of folks) {
        if (!peopleLines.length) {
          peopleLines.push("You see:");
        }
        peopleLines.push(`  ${person.name}: ${person.shortDescription}`);
      }
      if (room.visits === 0) {
        storyEvent.actions.push({
          type: "description",
          text: tmpl`
            ==> ${room.name} <==
            ${room.description}

            ${peopleLines.join("\n")}
            `,
        });
      } else if (room.visits < 4) {
        storyEvent.actions.push({
          type: "description",
          text: tmpl`
            ==> ${room.name}: ${room.shortDescription}
            ${peopleLines.join("\n")}
            `,
        });
      } else if (peopleLines.length > 0) {
        storyEvent.actions.push({
          type: "description",
          text: tmpl`
            ${peopleLines.join("\n")}
            `,
        });
      }
    } else if (tag.type === "examine") {
      storyEvent.actionRequests = [
        ...(storyEvent.actionRequests || []),
        this.makePromptRequest({
          examine: tag.content,
        }),
      ];
    }
    return storyEvent;
  }

  // This suppresses the normal Person response
  onStoryEvent(storyEvent: StoryEventType): void | ActionRequestType<any>[] {
    return undefined;
  }
}

export class NarratorClass extends Entity {
  type = "narrator";
  id = "narrator";
  name = "";
  color = "text-gray-300";
  shortDescription = "The unseen narrator of the story.";
  description = "";
  inside = "player";
  invisible = true;
}

function coerceBoolean(v: string) {
  v = v.toLowerCase();
  if (v === "true" || v === "yes" || v === "y" || v === "on" || v === "1") {
    return true;
  }
  if (v === "false" || v === "no" || v === "n" || v === "off" || v === "0") {
    return false;
  }
  console.warn("Unexpected boolean value:", JSON.stringify(v));
  return false;
}

function coerceNumber(v: string) {
  const num = Number(v);
  if (isNaN(num)) {
    console.warn("Unexpected number value:", JSON.stringify(v));
    return 0;
  }
  return num;
}

function IF(cond: any) {
  return cond ? TemplateTrue : TemplateFalse;
}

function fixupText(llmText: string) {
  return llmText.replace("…", "...").replace("&#x20;", " ").trim();
}
