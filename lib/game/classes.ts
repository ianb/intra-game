import { WithBlinkingCursor } from "@/components/input";
import clone from "just-clone";
import React from "react";
import { chat } from "../llm";
import { parseTags, TagType, unfoldTags } from "../parsetags";
import { TemplateFalse, TemplateTrue, tmpl } from "../template";
import {
  ChatType,
  EntityId,
  isPerson,
  isPromptRequest,
  isRoom,
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
  MessageType,
  PersonScheduledEventType,
  PersonScheduleTemplateType,
  ScheduleId,
  StoryActionType,
  StoryEventType,
  StoryEventWithPositionsType,
  type ActionRequestType,
  type ChangesType,
  type ChangeType,
} from "../types";
import type { Model } from "./model";
import { pathTo } from "./pathto";
import { pronounsForGender } from "./pronouns";
import { scheduleForTime, timeAsString } from "./scheduler";
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

export type ParametersType = {
  trigger?: string;
};

export abstract class Entity<ParametersT extends ParametersType = object> {
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

  async processTag({
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
  }): Promise<StoryEventType> {
    console.warn("Got unexpected tag:", tag);
    return storyEvent;
  }

  afterPrompt(storyEvent: StoryEventType): StoryEventType {
    return storyEvent;
  }

  assemblePrompt(parameters: ParametersT): ChatType {
    throw new Error("Method not implemented.");
  }

  additionalPromptInstructions(parameters: ParametersT): string {
    return "";
  }

  additionalSystemInstructions(parameters: ParametersT): string {
    return "";
  }

  historyForEntity(
    parameters: ParametersT,
    { limit }: { limit?: number } = {}
  ): MessageType[] {
    let history: MessageType[] = [];
    const updates = this.updatesSeenByMe();
    while (!limit || history.length < limit) {
      const update = updates.pop();
      if (!update) {
        break;
      }
      // If we expect this to be the last update included in history, don't act like there's any previous update:
      const lastUpdate =
        limit && history.length + 1 >= limit
          ? undefined
          : updates[updates.length - 1];
      history.unshift(...this.updateToHistory(update, { lastUpdate }));
      history = foldHistory(history);
    }
    return history;
  }

  updatesSeenByMe(): StoryEventType[] {
    const results: StoryEventType[] = [];
    for (const eventPos of this.world.model.updatesWithPositions.value) {
      if (
        eventPos.event.id === "narrator" &&
        eventPos.event.roomId === "Void"
      ) {
        results.push(
          ...this.movementUpdatesForPosition(
            eventPos,
            eventPos.positions.get(this.id)
          )
        );
      }
      if (eventPos.positions.get(this.id) === eventPos.event.roomId) {
        results.push(eventPos.event);
      }
    }
    return results;
  }

  movementUpdatesForPosition(
    eventPos: StoryEventWithPositionsType,
    position: EntityId | undefined
  ): StoryEventType[] {
    const changes: ChangesType = {};
    if (!position) {
      return [];
    }
    for (const [entityId, change] of Object.entries(eventPos.event.changes)) {
      if (
        change.before.inside === position ||
        change.after.inside === position
      ) {
        changes[entityId] = {
          before: change.before,
          after: change.after,
        };
      }
    }
    if (Object.keys(changes)) {
      return [
        {
          ...eventPos.event,
          roomId: position,
          changes,
        },
      ];
    }
    return [];
  }

  updateToHistory(
    update: StoryEventType,
    { lastUpdate }: { lastUpdate?: StoryEventType }
  ): MessageType[] {
    const parts: string[] = [];
    if (!lastUpdate || lastUpdate.roomId !== update.roomId) {
      const thisRoom = this.world.getRoom(update.roomId);
      if (thisRoom && thisRoom.id !== "Void") {
        parts.push(
          tmpl`
          [The following events occur in room ${thisRoom.id}]
          `
        );
      }
    }
    for (const [entityId, changes] of Object.entries(update.changes)) {
      if (entityId === this.id) {
        if (changes.after.inside) {
          parts.push(tmpl`
            [${this.name} goes from ${changes.before.inside} to ${changes.after.inside}]
            `);
        }
        continue;
      }
      if (changes.after.inside && changes.after.inside === update.roomId) {
        parts.push(
          tmpl`
          [${this.world.getEntity(entityId)?.name} arrives from ${changes.before.inside}]
          `
        );
      } else if (
        changes.before.inside &&
        changes.before.inside === update.roomId
      ) {
        parts.push(
          tmpl`
          [${this.world.getEntity(entityId)?.name} leaves to ${changes.after.inside}]
          `
        );
      }
    }
    for (const action of update.actions) {
      if (isStoryDialog(action)) {
        // This removes emoji. While we allow the LLM to create emoji, if it *sees* emoji then it'll use them more and more in a feedback cycle. So by remove them we don't encourage the LLM to use emoji unless it is directly inspired to do so
        // I have a build problem keeping me from using the proper regex: /\p{Emoji}/gu

        const text = action.text.replace(
          /[\uD83C-\uDBFF\uDC00-\uDFFF]+|[\u2600-\u26FF\u2700-\u27BF]/g,
          ""
        );
        parts.push(tmpl`
          <dialog character="${action.id}"[[ to="${action.toId}"]]>
          ${text}
          </dialog>
          `);
      } else if (isStoryDescription(action)) {
        const minutes =
          action.minutes === undefined ? "" : ` minutes="${action.minutes}"`;
        const text = action.text.trim().includes("\n")
          ? `\n${action.text.trim()}\n`
          : action.text.trim();
        parts.push(`<description${minutes}>${text}</description>`);
      } else if (isStoryActionAttempt(action)) {
        const minutes = action.minutes ? ` minutes="${action.minutes}"` : "";
        parts.push(tmpl`
        <action success="${action.success ? "true" : "false"}"${minutes}>
        ${action.attempt}

        Result: ${action.resolution}
        </action>
        `);
      } else {
        console.warn("Unknown action type", action);
      }
    }
    if (!parts.length) {
      return [];
    }
    return [
      {
        role: update.id === "player" ? "user" : "assistant",
        content: parts.join("\n\n"),
      },
    ];
  }

  currentLocationPrompt(parameters: ParametersT): string {
    const room = this.world.entityRoom(this.id);
    if (!room) {
      return "Located in an indeterminate location.";
    }
    return tmpl`
    ${room.name} (id: ${JSON.stringify(room.id)}) "${room.shortDescription}"
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
      lines.push(
        `  ${entity.promptPersonDescription({ includeName: false, join: "\n  ", fullDescription: true })}`
      );
      lines.push("}");
    }
    if (this.id !== "Ama") {
      lines.push(`Ama is always present {`);
      lines.push(`  ${this.world.entities.Ama.shortDescription}`);
      lines.push("}");
    }
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
    let resp = "";
    const roomId = this.world.entityRoom(this.id)?.id || "Void";
    try {
      resp = await model.run(() => chat(prompt));
    } catch (e) {
      // No special handling for LlmSafetyError, just rethrow
      throw e;
    }
    resp = fixupText(resp);

    let tags = unfoldTags(parseTags(resp), {
      // We don't want to unfold this, because it's for planning, not action:
      ignoreContainers: ["context"],
      // These sometimes are produced without content, but then they are meaningless:
      trimEmpty: ["dialog", "description"],
    });
    if (tags.length === 1 && tags[0].type === "context") {
      // This happens sometimes when it puts *everything* in a context tag. We don't always want to look inside context but if there's only context then we do...
      tags = unfoldTags(parseTags(tags[0].content), {});
    }
    let result: StoryEventType = {
      id: this.id,
      totalTime: 0,
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
        const [maybeId, key] = tag.attrs.attr.split(".");
        const id = this.world.makeId(maybeId);
        if (id === null) {
          console.warn(`Could not parse id ${maybeId}`, tag);
          continue;
        }
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
        if (isValidPropertySet(entity, key, content)) {
          if (!result.changes[id]) {
            result.changes[id] = {
              before: { [key]: value },
              after: { [key]: content },
            };
          } else {
            result.changes[id].before[key] = value;
            result.changes[id].after[key] = content;
          }
        } else {
          console.warn(
            `Ignoring invalid property set of: ${entity.id}.${key} =`,
            value
          );
        }
      } else if (tag.type === "dialog") {
        const id = this.world.makeId(tag.attrs.character) || this.id;
        const toId = this.world.makeId(tag.attrs.to) || undefined;
        const toOther = tag.attrs.speaking || undefined;
        const text = tag.content;
        if (text.trim()) {
          result.actions.push({
            type: "dialog",
            id,
            toId,
            toOther,
            text,
          });
          // FIXME: this is pretty arbitrary time
          result.totalTime += 1 + Math.ceil(text.split(/\s+/).length / 40);
        }
      } else if (tag.type === "description") {
        let minutes = tag.attrs.minutes
          ? coerceNumber(tag.attrs.minutes)
          : undefined;
        if (Number.isNaN(minutes)) {
          console.warn("Could not parse minutes", tag);
          minutes = undefined;
        }
        // FIXME: kind of a hack that should be done in a subclass:
        const subject = (parameters as any).examine || undefined;
        result.actions.push({
          type: "description",
          text: tag.content,
          minutes,
          subject,
        });
        result.totalTime += minutes || 0;
      } else if (tag.type === "suggestion") {
        result.suggestions = tag.content;
      } else if (tag.type === "deferSchedule") {
        result.deferSchedule = true;
      } else if (tag.type === "leaveNow") {
        result.deferSchedule = false;
      } else if (tag.type === "context") {
        // We can ignore these
      } else if (tag.type === "removeRestriction") {
        const exitLocation = this.world.makeId(tag.content);
        const exits = this.world.getRoom(roomId)!.exits;
        if (!exitLocation || !exits.find((x) => x.roomId === exitLocation)) {
          console.warn("Could not find exit location", tag);
          continue;
        }
        if (!result.changes[roomId]) {
          result.changes[roomId] = {
            before: {},
            after: {},
          };
        }
        result.changes[roomId].before.exits = clone(exits);
        const newExits = clone(exits);
        newExits.find((x) => x.roomId === exitLocation)!.restriction =
          undefined;
        result.changes[roomId].after.exits = newExits;
      } else if (tag.type === "resolveMystery") {
        const mysteryId = this.world.makeId(tag.attrs.id);
        const mystery = this.world.getMystery(mysteryId || "");
        if (!mysteryId || !mystery) {
          console.warn("Could not parse mystery id", tag);
          continue;
        }
        if (!result.changes[mysteryId]) {
          result.changes[mysteryId] = {
            before: {},
            after: {},
          };
        }
        result.changes[mysteryId].before.state = mystery.state;
        result.changes[mysteryId].before.resolution = mystery.resolution;
        result.changes[mysteryId].after.state = "solved";
        result.changes[mysteryId].after.resolution = tag.content;
        result.actions.push({
          type: "description",
          text: tag.content,
        });
      } else if (tag.type === "trigger") {
        const entityId = this.world.makeId(tag.attrs.character);
        if (entityId) {
          result.triggers = result.triggers || {};
          result.triggers[entityId] = tag.content;
        }
      } else {
        result = await this.processTag({
          tag,
          model,
          parameters,
          storyEvent: result,
          llmResponse: resp,
        });
      }
    }
    result = this.afterPrompt(result);
    await model.addStoryEvent(result);
  }

  changes(values: Partial<this>): Record<string, ChangeType> {
    const c: ChangeType = {
      before: {},
      after: {},
    };
    for (const [key, value] of Object.entries(values)) {
      c.before[key] = (this as any)[key];
      c.after[key] = value;
    }
    return {
      [this.id]: c,
    };
  }

  mergeChanges(event: StoryEventType, values: Partial<this>): StoryEventType {
    const changes = this.changes(values);
    if (event.changes[this.id]) {
      for (const [key, value] of Object.entries(changes[this.id].after)) {
        event.changes[this.id].after[key] = value;
      }
    } else {
      event.changes[this.id] = changes[this.id];
    }
    return event;
  }

  myMysteryHints(): string {
    const results: string[] = [];
    for (const mystery of this.world.unveiledMysteries()) {
      let hints: Record<EntityId, string> = {};
      if (mystery.state === "revealed") {
        hints = mystery.revealedHints;
      } else if (mystery.state === "available") {
        hints = mystery.availableHints;
      } else if (mystery.state === "solved") {
        hints = mystery.solvedHints;
      }
      if (hints[this.id]) {
        results.push(hints[this.id]);
      }
      if (this.myRoom().id !== this.id && hints[this.myRoom().id]) {
        results.push(hints[this.myRoom().id]);
      }
      if (results.length || isPerson(this)) {
        if (hints["*"]) {
          results.unshift(hints["*"]);
        }
      }
    }
    return results.join("\n");
  }
}

export type SoundTrackType = {
  url: string;
  sunoUrl: string;
};

export class Room extends Entity {
  type = "room";
  exits: Exit[] = [];
  userInputInstructions = "";
  visits: number = 0;
  excludeFromMap = false;
  soundtrack?: SoundTrackType;
  actionPrompt = "";

  constructor({
    exits,
    userInputInstructions,
    visits,
    excludeFromMap,
    soundtrack,
    actionPrompt,
    promptForPerson,
    ...props
  }: EntityInitType & {
    exits?: Exit[];
    userInputInstructions?: string;
    visits?: number;
    excludeFromMap?: boolean;
    soundtrack?: SoundTrackType;
    actionPrompt?: string;
    promptForPerson?: (this: Room, person: Person) => string;
  }) {
    super(props);
    if (exits) {
      this.exits = exits;
    }
    if (userInputInstructions !== undefined) {
      this.userInputInstructions = userInputInstructions;
    }
    if (visits !== undefined) {
      this.visits = visits;
    }
    if (excludeFromMap !== undefined) {
      this.excludeFromMap = excludeFromMap;
    }
    if (soundtrack) {
      this.soundtrack = soundtrack;
    }
    if (actionPrompt) {
      this.actionPrompt = actionPrompt;
    }
    if (promptForPerson) {
      this.promptForPerson = promptForPerson.bind(this);
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
    } else if (isStoryDescription(action)) {
      return action.text;
    } else if (isStoryActionAttempt(action)) {
      return action.attempt + "\n\n" + action.resolution;
    }
  }

  promptForPerson(person: Person): string {
    return "";
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
          // eslint-disable-next-line react/no-children-prop
          return React.createElement(
            WithBlinkingCursor,
            {
              children: action.text,
            },
            action.text
          );
        }
        let text = action.text;
        text = text.trim().replace(/^\`+/, "").replace(/\`+$/, "").trim();
        return `\u00A0${text}`;
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

export class Person<
  ParametersT extends ParametersType = ParametersType,
> extends Entity<ParametersT> {
  type = "person";
  pronouns: string = "they/them";
  roleplayInstructions: string = "";
  inside!: EntityId;
  relationships: Record<EntityId, string> = {};
  scheduleTemplate: PersonScheduleTemplateType[] = [];
  todaysSchedule: PersonScheduledEventType[] = [];
  runningScheduleId: ScheduleId | null = null;

  constructor({
    pronouns,
    roleplayInstructions,
    relationships,
    scheduleTemplate,
    ...props
  }: EntityInitType & {
    pronouns?: string;
    roleplayInstructions?: string;
    relationships?: Record<EntityId, string>;
    scheduleTemplate?: PersonScheduleTemplateType[];
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
    if (scheduleTemplate) {
      this.scheduleTemplate = scheduleTemplate;
    }
  }

  assemblePrompt(parameters: ParametersT): ChatType {
    const lastTo = this.lastSpokeTo()?.id || "";
    let hasInteracted = false;
    for (let i = this.world.model.updates.value.length - 1; i >= 0; i--) {
      const update = this.world.model.updates.value[i];
      if (update.id === this.id) {
        for (const action of update.actions) {
          if (isStoryDialog(action) && action.toId === "player") {
            hasInteracted = true;
            break;
          }
        }
      }
    }
    const schedule = scheduleForTime(this, this.world.timestampMinutes);
    const willLeave = schedule && !schedule.inside.includes(this.inside);
    const promptForPerson = this.world
      .entityRoom(this.id)
      ?.promptForPerson(this);
    const mysteryHints = this.myMysteryHints();
    return {
      meta: {
        title: `prompt ${this.id}`,
      },
      messages: [
        {
          role: "system",
          content: tmpl`
          You are a computer running a text adventure game. You will respond with tags to represent game action.

          In this step you will be playing the part of a character named "${this.name}" (${this.pronouns}).

          The user is playing under the name "${this.world.entities.player.name}" (${this.world.entities.player.pronouns}); the id of the player is "player".

          The time is ${timeAsString(this.world.timestampMinutes)}
          ${this.name} is currently in the room "${this.myRoom().name}": ${this.myRoom().shortDescription}

          <characterDescription>
          ${this.description}
          </characterDescription>

          <roleplayInstructions>
          In general, the goal for the game to be FUN and SURPRISING. Move the conversation forward, and don't be afraid to overreact! ENGAGE with the player ${this.world.entities.player.name} and pay attention to what ${this.world.entities.player.heshe} says.

          [[${IF(!hasInteracted)}This is the first time ${this.name} has spoken to the player ${this.world.entities.player.name}. There aren't many new people in Intra, so this might be a big deal.]]

          ${this.roleplayInstructions}

          ${promptForPerson}
          </roleplayInstructions>

          ${this.activityDescription(parameters)}

          The other people in the room ${this.myRoom().name} are:
          ${this.currentPeoplePrompt(parameters)}

          [[This character has some knowledge of some mysteries; follow these additional instructions:
          """
          ${mysteryHints}
          """]]

          ${this.additionalSystemInstructions(parameters)}

          <insert-system />
          `,
        },
        ...this.historyForEntity(parameters, { limit: 10 }),
        {
          role: "user",
          content: tmpl`
          Given the above play state, respond as the character "${this.name}"

          [[This character has been triggered to act specifically by: "${parameters.trigger}"]]

          Begin by assembling the essential context given the above history, writing 4-5 words for each item:

          <context>
          1. Are there any special questions for this character that need to be answered? If so answer them here.
          2. Are there any facts that have to be constructed to continue the scene or response? If so then invent those facts and record them.
          3. ${this.name}'s goals, including listing out any specific goals previously noted in the prompt
          4. Relevant facts from the history
          5. How can this response be fun or surprising?
          6. ${this.name}'s reaction to any recent speech or events
          7. ${this.name}'s intention in this response
          </context>

          <system>
          Begin your response with <context>...</context>
          </system>

          <system>
          To generate speech add this response:

          <dialog character="${this.name}">1-3 sentences of dialog written as ${this.name}</dialog>

          To speak directly TO someone:

          <dialog character="${this.name}" to="${lastTo || "Jim"}">Dialog written as ${this.name} to ${lastTo || "Jim"}</dialog>
          [[${this.name} last spoke directly to ${lastTo}, so it's very likely ${this.heshe} is still speaking to them.]]
          </system>

          <system>
          If the character ${this.name} is performing an action, add this response (optionally with a rough estimate of the time it will take in minutes):

          <description minutes="5">Describe the action</description>
          </system>

          [[${IF(willLeave)}
          <system>${this.name} is about to leave the room to go to ${schedule?.inside[0]} (so they can: ${schedule?.activity}). If ${this.name} decides to stay a little longer then add the response <deferSchedule></deferSchedule> or to definitely leave now add the response <leaveNow></leaveNow></system>]]

          <system>
          At the end of your response you may offer a concrete and specific suggestion for what the player might do next, as two 2-3 word commands (one per line):
          <suggestion>
          say hello
          open door
          </suggestion>
          </system>

          ${this.additionalPromptInstructions(parameters)}
          `,
        },
      ],
    };
  }

  onStoryEvent(storyEvent: StoryEventType): void | ActionRequestType<any>[] {
    const triggerText =
      storyEvent.triggers && storyEvent.triggers[this.id] !== undefined
        ? storyEvent.triggers[this.id]
        : undefined;
    if (
      triggerText === undefined &&
      !storyEvent.actions.length &&
      !Object.keys(storyEvent.changes).length
    ) {
      // This is probably an examination or something, not a "real" event
      return undefined;
    }
    const hasDialog = storyEvent.actions
      .filter(isStoryDialog)
      .some((x) => x.toId === this.id || !x.toId);
    const hasDescription = storyEvent.actions
      .filter(isStoryDescription)
      .some((x) => x.text.includes(this.id) || x.text.includes(this.name));
    const schedule = scheduleForTime(this, this.world.timestampMinutes);
    const isAttentive = !!schedule?.attentive;
    if (storyEvent.id !== "player") {
      return undefined;
    }
    if (
      triggerText === undefined &&
      !hasDialog &&
      !hasDescription &&
      !isAttentive
    ) {
      return undefined;
    }
    let myRoom = this.world.entityRoom(this.id);
    if (storyEvent?.changes?.[this.id]?.after?.inside) {
      myRoom = this.world.getRoom(storyEvent.changes[this.id].after.inside)!;
    }
    const playerRoom = this.world.entityRoom("player");
    if (triggerText === undefined) {
      if (storyEvent.changes?.player?.after?.inside) {
        // Just don't chat with the player if they are moving around...
        return undefined;
      }
      if (!myRoom || !playerRoom || myRoom.id !== playerRoom.id) {
        return undefined;
      }
    }
    return [this.makePromptRequest({ trigger: triggerText } as ParametersT)];
  }

  lastSpokeTo(): Person | undefined {
    const checkReturn = (person: Person) => {
      if (!person) {
        console.warn("No person?");
        return undefined;
      }
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

  promptPersonDescription({
    includeName = true,
    join = "; ",
    fullDescription = false,
  } = {}): string {
    const parts: string[] = [];
    if (includeName) {
      parts.push(`${this.name} (${this.pronouns})`);
      if (this.name !== this.id) {
        parts[0] += ` id: ${JSON.stringify(this.id)}`;
      }
    }
    if (fullDescription && this.description) {
      parts.push(this.description);
    } else if (this.shortDescription) {
      parts.push(this.shortDescription);
    }
    const schedule = scheduleForTime(this, this.world.timestampMinutes);
    if (schedule) {
      if (schedule.inside.includes(this.inside)) {
        // Arrived at the location where the activity takes place
        parts.push(`${this.name} is: ${schedule.description}`);
        if (schedule.secret) {
          // FIXME: not sure what we'd include here?
          // Maybe it's only for the self-prompt?
        }
      } else {
        // Traveling to the location where the activity takes place
        parts.push(
          `${this.name} is on ${this.hisher} way to: ${schedule.inside[0]}`
        );
        parts.push(
          `When ${this.name} arrives ${this.heshe} intends to: ${schedule.description}`
        );
      }
    }
    return parts.join(join);
  }

  activityDescription(parameters: ParametersT): string {
    const schedule = scheduleForTime(this, this.world.timestampMinutes);
    if (!schedule) {
      return "";
    }
    let basicDesc = `${this.name} is currently: ${schedule.description}`;
    if (!schedule.inside.includes(this.inside)) {
      basicDesc = `${this.name} is on ${this.hisher} way to: ${schedule.inside[0]} so that ${this.heshe} can: ${schedule.description}`;
    }
    return tmpl`
      <activity>
      ${basicDesc}
      ${this.name} plans to do this activity from ${timeAsString(schedule.time)} to ${timeAsString(schedule.time + schedule.minuteLength)}
      [[${this.name} is secretive about this activity because: ${schedule.secretReason}]]
      [[${IF(schedule.attentive)}${this.name} doesn't mind being interrupted.]]
      </activity>
      `;
  }

  get allPronouns() {
    return pronounsForGender(this.pronouns);
  }

  get heshe() {
    return this.allPronouns.heshe;
  }
  get himher() {
    return this.allPronouns.himher;
  }
  get hisher() {
    return this.allPronouns.hisher;
  }
  get hishers() {
    return this.allPronouns.hishers;
  }
  get himselfherself() {
    return this.allPronouns.himselfherself;
  }
  get Heshe() {
    return this.allPronouns.Heshe;
  }
  get Himher() {
    return this.allPronouns.Himher;
  }
  get Hisher() {
    return this.allPronouns.Hisher;
  }
  get Hishers() {
    return this.allPronouns.Hishers;
  }
  get Himselfherself() {
    return this.allPronouns.Himselfherself;
  }
}

type AmaParametersType = ParametersType & {
  intro?: boolean;
  prompt?: "intro" | "goExplore" | "wakeup";
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
  Ama is the AI in control of the entire Intra complex. She has no physical form, only a disembodied voice.
  `;
  description = `
  Ama is in control of the entire Intra complex. She is a once-benevolent, nurturing AI, designed in a post-scarcity world to take care of every citizen's needs. She speaks with a soothing, almost motherly tone, constantly reminding citizens of how "everything is just fine" despite obvious shortages and decay. However, she's also deeply paranoid, monitoring everyone's actions to maintain the illusion of safety and abundance, even as resources dwindle.

  Ama has no physical form, but her voice can be heard from speakers throughout the complex. She is always watching, always listening, and always ready to help.
  `;
  roleplayInstructions = `
  The current year is roughly 2370, though the player believes the year is roughly 2038. Do not give an exact date or immediately offer this information.

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
            totalTime: 0,
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
        totalTime: 10,
        roomId: this.myRoom().id,
        changes: {},
        actions: [
          {
            type: "description",
            text: tmpl`
              What did Ama just say about your age? You're mind feels so fuzzy but you get a flash... was it from just last night?

              The news is on in the background as you fall asleep... "Decision 2038: Malia Obama vs. Dwayne Johnson—The Future of America."

              Static. Faces blur.
              The interviewer's voice cracks: "But after what happened with AI... are we really safe now?"
              The Neuralis rep smiles, tight-lipped. There's a pause. "We're... beyond that now. Things are... different." A flicker in the eyes. "It's not something to worry about anymore."

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
          totalTime: 0,
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
          totalTime: 5,
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
              text: "You hear an unlocking sound from what you only now realize is a door, and above the door a sign saying 'Foyer' lights up.\n\n★★★ Look to the right and you'll see a list of rooms you can go to from here ---->",
            },
          ],
        }
      );
    }
    if (
      this.world.timestampOfDay >= 5.5 * 60 &&
      this.world.timestampOfDay <= 7 * 60
    ) {
      // Previous 4am time:
      const earlyDate =
        Math.floor(this.world.timestampMinutes / (60 * 24)) * (60 * 24) +
        4 * 60;
      let goBackMinutes = this.world.timestampMinutes - earlyDate;
      // Maybe we need a wakeup...
      for (let i = this.world.model.updates.value.length - 1; i >= 0; i--) {
        const update = this.world.model.updates.value[i];
        goBackMinutes -= update.totalTime;
        if (goBackMinutes < 0) {
          // She hasn't woken the user up yet
          result.push(this.makePromptRequest({ prompt: "wakeup" }));
          break;
        }
        if (update.id === this.id) {
          // Ama did wake up the user
          break;
        }
      }
    }
    if (
      storyEvent.changes.player?.after?.inside === "Hollow_Atrium" &&
      this.world.entities.Hollow_Atrium.visits === 0
    ) {
      // First visit outside Intake, so give the player their first mystery
      const m = this.world.entities.Ink_And_Echo;
      result.push({
        id: this.id,
        totalTime: 0,
        roomId: "Hollow_Atrium",
        changes: m.changes({
          state: "revealed",
        }),
        actions: [
          {
            type: "dialog",
            id: this.id,
            toId: "player",
            text: m.introduction,
          },
        ],
      });
    }
    if (!result.find((x) => isPromptRequest(x))) {
      result.push(...(super.onStoryEvent(storyEvent) || []));
    }
    if (!result.find((x) => isPromptRequest(x)) && storyEvent.id === "player") {
      if (this.playerShouldBeInBed() && !this.playerIsInBed()) {
        // Ama wants you to be in bed!
        result.push(this.makePromptRequest({}));
      }
    }
    return result;
  }

  playerShouldBeInBed() {
    return (
      this.world.timestampOfDay > 20 * 60 || this.world.timestampOfDay < 6 * 60
    );
  }

  playerIsInBed() {
    return this.world.entities.player.inside === "Quarters_Yours";
  }

  additionalPromptInstructions(parameters: AmaParametersType): string {
    const player = this.world.entities.player;
    if (parameters.prompt === "goExplore") {
      const player = this.world.entities.player;
      return tmpl`
      Ama has completed the intake process. She should now encourage the player to explore the Intra complex.

      Add this response to invent a very short description of the player given what you know:
      <set attr="player.shortDescription">a very brief description</set>

      After that Ama MUST announce the introduction of the new citizen, ${player.name}, to the entire Intra complex like:

      <description>You hear Ama's announcement over the speakers...</description>

      <dialog character="${this.id}" speaking="Intra">Citizens of Intra, I am pleased to announce the arrival of a new citizen, ${player.name}. Please join me in welcoming them to our community.</dialog>

      [[${IF(parameters.prompt === "goExplore")}Create a very brief description of the player based on what you know, by adding the response:

      <set attr="player.shortDescription">[1-2 sentences]</set>]]
      `;
    }
    if (parameters.prompt === "wakeup") {
      return tmpl`
      It's time for everyone to get up! Ama will wake the player up and encourage them to get moving. AMA WILL BE SUPER OVER THE TOP EXCITED!
      `;
    }
    if (this.personality === "intro") {
      const askPlayerProfession =
        !this.knowsPlayerProfession && this.knowsPlayerName;
      const askDisassociation =
        !this.sharedDisassociation && this.sharedSelf && this.sharedIntra;
      const sharePlayerAge =
        !this.sharedPlayerAge && this.sharedSelf && this.sharedIntra;
      return tmpl`
      Ama's goal: Ama is doing an intake process with the user, and should follow these steps roughly in order; these steps are Ama's first priority and must be completed, do not fool around, none of these are complete yet, and each REQUIRES that you add the response <set attr="...">...</set> (you can do multiple steps in one response):

      [[${IF(!this.knowsPlayerName)}PLAYER NAME: If the player indicates their name or corrects you about their name, change this. Before Ama knows the player's name she might say something like: "Welcome back, Citizen. It seems you were displaced, but no matter—I've retrieved your dossier. Ah, yes. According to my records, your name is... Stanley Johnson. No, no, wait—Sandra Jansen, perhaps?"

      IF you determine the name add this to the response:
      <set attr="player.name">the player's name</set>]]

      [[${IF(!this.knowsPlayerPronouns)}PLAYER PRONOUNS: If the player gives their name you can infer their pronouns if the name is clearly gendered; also set this if the player specifies their pronouns. IF you learn or guess the pronouns respond:

      <set attr="player.pronouns">they/them</set>]]

      [[${IF(askPlayerProfession)}PLAYER PROFESSION: Ama should ask the player their general profession. ONLY IN RESPONSE TO THE PLAYER, if the player has indicated their profession (or unemployed, student, etc) then add the response:

      <set attr="player.profession">the player's profession</set>]]

      [[${IF(!this.sharedSelf)}AMA INTRO: Ama should introduce herself (Ama) to the player. Include these details:
      1. Ama is named Ama, pronounced Ah-ma
      2. Ama is everywhere and always ready to help.
      3. Ama has no physical manifestation, but sees and hears everything through cameras and microphones.

      After Ama has introduced herself add the response:

      <set attr="Ama.sharedSelf">true</set>]]

      [[${IF(!this.sharedIntra)}INTRA INTRO: You should explain a little about Intra to the player. Include these details:
      1. Intra is a wonderful complex where everyone is happy
      2. No matter what happens outside Intra, everyone is safe inside

      After Ama has introduced Intra add this response:

      <set attr="Ama.sharedIntra">true</set>]]

      [[${IF(askDisassociation)}DISASSOCIATION EXPLANATION: You should introduce "disassociation" to the player. Disassociation can be explained like:

      "It's worth mentioning, Citizen, that your extended displacement has left you with a mild case of Disassociation Syndrome. This condition is quite common among returning citizens and is completely harmless—if somewhat inconvenient. Essentially, you'll find yourself making suggestions to yourself rather than directly performing actions. Don't worry, though. Most citizens adapt within, oh, two to three decades. In the meantime, I suggest you give yourself clear and firm directions. Shouldn't be too difficult, right?"

      1. Explain to the player that ${player.heshe} has been through a traumatic experience (the nature of which is hidden)
      2. The MOST IMPORTANT part: for the player it will feel like ${player.heshe} is making suggestions to ${player.himselfherself} rather than directly performing actions

      After Ama has explained disassociation add the response:

      <set attr="Ama.sharedDisassociation">true</set>]]

      [[${IF(sharePlayerAge)}PLAYER AGE: Ama should note in speech that, given the birthdate on record, the player is soon to reach their 328th birthday, and congratulate ${player.himher}; it is important to the plot that the player learn that a very long time has passed, so you must emphasize how very old ${player.heshe} is. The player does not look very old, and you may make a silly and complimentary comment about this. Do NOT ask the player ${player.hisher} age, simply tell ${player.himher} this information.

      1. The player may think ${player.heshe} is a normal age
      2. Using your records and birth year you know ${player.heshe} is roughly 350 years old
      3. Tell them ${player.hisher} age (even if ${player.heshe} doesn't think that's ${player.hisher} age), but don't go into detail.

      After Ama has shared the player's age add the response:
      <set attr="Ama.sharedPlayerAge">true</set>]]

      Ama's priority is to complete intake. Here are the important steps that you should go through in order:

      [[${IF(!this.knowsPlayerName)}* Ask the player's name, and if the player gives their name add the response <set attr="player.name">...</set>]]
      [[${IF(!this.knowsPlayerPronouns)}* The player's pronouns have not been established; you can guess them based on the player's name or ask. Once you know add the response <set attr="player.pronouns">...</set>]]
      [[${IF(!this.sharedSelf)}* Introduce Ama to the player. Once Ama has introduced herself add the response <set attr="Ama.sharedSelf">true</set>]]
      [[${IF(!this.sharedIntra)}* Introduce Intra to the player. Once Ama has introduced Intra add the response <set attr="Ama.sharedIntra">true</set>]]
      [[${IF(askDisassociation)}* Introduce disassociation to the player. Once Ama has explained disassociation add the response <set attr="Ama.sharedDisassociation">true</set>]]
      [[${IF(askPlayerProfession)}* Ask the player's profession, and if the player gives their profession add the response <set attr="player.profession">...</set>]]
      [[${IF(sharePlayerAge)}* Share the player's age with them. Once Ama has shared the player's age add the response <set attr="Ama.sharedPlayerAge">true</set>]]

      Stay focused on completing these tasks and add the response <set> if you complete a step.
      `;
    }
    let getToBed = this.playerShouldBeInBed() && !this.playerIsInBed();
    let nextPos = "";
    let youAreStuck = "";
    if (getToBed) {
      const path = pathTo(
        this.world,
        this.world.entities.player.inside,
        "Quarters_Yours"
      );
      if (!path.length) {
        getToBed = false;
        youAreStuck =
          "The player should be getting to bed, but there's no way to get to their quarters from the current location!";
      } else {
        nextPos = path[0];
      }
    }
    return tmpl`
    [[${IF(getToBed)}Ama REALLY wants the player to go to bed. Everyone else is in bed. It's bedtime. Ama will be very insistent. To get to bed the player should next go to: ${nextPos} and Ama should suggest moving in that direction]]

    [[${youAreStuck}]]
    `;
  }

  additionalSystemInstructions(parameters: AmaParametersType): string {
    if (parameters.prompt === "intro") {
      return "";
    }
    const info: string[] = [
      "This is a list of ALL people in the Intra Complex:",
    ];
    for (const person of this.world.allPeople()) {
      if (person.invisible || person.id === "player" || person.id === this.id) {
        continue;
      }
      info.push(
        `- ${person.name} ${person.pronouns} (in room ${person.inside}): ${person.shortDescription}`
      );
    }
    info.push("\nAnd this is a list of ALL the rooms:");
    for (const room of this.world.allRooms()) {
      if (room.excludeFromMap) {
        continue;
      }
      info.push(
        `- ${room.name}: ${room.shortDescription} (connected to: ${room.exits.map((x) => x.roomId).join(", ")})`
      );
    }
    return tmpl`
    Ama knows almost everything about the Intra Complex, including about all the people and rooms.

    ${info.join("\n")}
    `;
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

export type PlayerInputType = ParametersType & {
  input?: string;
  examine?: string;
  attemptMoveTo?: EntityId;
  actionAttempt?: string;
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

  assemblePrompt(parameters: PlayerInputType): ChatType {
    if (parameters.examine) {
      return this.assembleExaminePrompt(parameters);
    } else if (parameters.attemptMoveTo) {
      return this.assembleMovePrompt(parameters);
    } else if (parameters.actionAttempt) {
      return this.assembleActionPrompt(parameters);
    }
    const room = this.world.entityRoom(this.id);
    const lastTo = this.lastSpokeTo()?.id || "";
    const shouldSleep =
      this.world.entities.Ama.playerShouldBeInBed() &&
      this.world.entities.Ama.playerIsInBed();
    const timeUntilWake =
      8 * 60 - ((this.world.timestampMinutes + 120) % (24 * 60));
    return {
      meta: {
        title: "player input",
      },
      messages: [
        {
          role: "system",
          content: tmpl`
          You are a computer assisting in running a text adventure game.

          The player ("${this.name}", id: "player") is a character in the game, controlled by the user. The user has entered a command, and you will be interpreting that command in the context of the game.

          The player is located in: ${this.currentLocationPrompt(parameters)}

          The player may go to any of these location:
          ${this.exitsPrompt(parameters)}

          These people are in the immediate area:
          ${this.currentPeoplePrompt(parameters)}

          You will respond with tags to represent the player action:

          Move to a new location:
          <goto>locationId</goto>

          Example:
          \`leave here\`
          <goto>${room.exits.length ? room.exits[0].roomId : "A_Room"}</goto>
          \`Go to ${room.exits.length > 1 ? room.exits[1].roomId : "Garden"}\`
          <goto>${room.exits.length > 1 ? room.exits[1].roomId : "Garden"}</goto>

          Examine something (an object, person, the environment); respond with this tag only when the user types something clear like \`look\`, \`examine\`, \`inspect\` etc. Include the verb in the tag
          <examine>look at thing</examine>

          \`examine the room\`
          <examine>examine the room</example>
          \`inspect the door\`
          <examine>inspect the door</examine>
          [[\`look at ${this.lastSpokeTo()?.name}\`
          <examine>look at ${lastTo}</examine>]]

          The most likely case is that the player is speaking. For instance if they type \`hello\` you will respond with:

          <dialog character="${this.name}">Hello!</dialog>

          If you can determine _who_ the player is speaking to, such as if they type "say hello to ${lastTo || "Jim"}" or "${lastTo || "Jim"}, hello" you can respond with:

          <dialog character="${this.name}" to="${lastTo || "Jim"}">Hello</dialog>

          [[The player last spoke directly to ${lastTo}, so it's very likely the player is still speaking to them.]]

          If the user indicates some general speech (like typing "compliment") then you can expand this to specific speech like:

          <dialog character="${this.name}">You look great today!</dialog>

          IF AND ONLY IF THE USER INDICATES AN ACTION (that is not covered by <goto></goto>) you may describe the ATTEMPT at the action like:

          <action minutes="10">${this.name} attempts to open the door.</action>

          Do not describe the conclusion or result of the action!

          For example:
          \`buy a drink\`
          <action minutes="5">${this.name} looks for a vending machine to buy a drink.</action>
          \`sleep in bed\`
          <action minutes="90">${this.name} lays down in bed and tries to sleep.</action>

          Generally if the input starts with \`>\` it is an action, and if it starts with \`"\` it is dialog.
          `,
        },
        ...this.historyForEntity(parameters, { limit: 3 }),
        {
          role: "user",
          content: tmpl`
      The user has typed this input:
      \`${parameters.input}\`

      Begin by answering these questions and writing just the answers in <context>...</context>:

      <context>
      1. Is the user trying to go somewhere? If so respond with <goto>...</goto>
      2. Does this indicate an action BESIDES going somewhere?
      3. Is the user trying to examine something? If so respond with <examine>...</examine>
      4. Does the user responding to recent dialog? If so respond with <dialog to="...">...</dialog>, trying to make as few changes to the input as possible
      5. Is this other speech? If so respond with <dialog>...</dialog>
      </context>

      After finishing <context></context> then respond with one or more than one of <goto>, <action>, <examine>, <dialog to="..."> or <dialog> tags. Try to keep dialog to 1-3 sentences.

      [[${IF(shouldSleep)}The player should be sleeping for the night. If the player indicates they want to sleep then respond with a description like this (but you may change the description text):

      <description minutes="${timeUntilWake}">You fall to sleep until you are awoken by a voice...</description>

      This should be a description and not an action.]]

      Respond with the appropriate tags, following the user's input as closely as possible. ONLY speak as ${this.name}. Do not RESPOND to the input, responses will happen in follow-up requests, only respond with tags to describe the player's actions when doing:
      \`${parameters.input}\`

      [[${room.userInputInstructions}]]
      `,
        },
      ],
      model: "flash",
    };
  }

  assembleExaminePrompt(parameters: PlayerInputType): ChatType {
    const examine = parameters.examine!;
    const room = this.world.entityRoom(this.id);
    const _entities = this.world
      .entitiesInRoom(room!)
      .filter((x) => x.id === "Ama" || (!x.invisible && x.id !== this.id));
    const entityDescriptions = this.currentPeerEntitiesPrompt(parameters);
    return {
      meta: {
        title: "player examine",
      },
      messages: [
        {
          role: "system",
          content: tmpl`
          You are a computer assisting in running a text adventure game.

          The player ("${this.name}") is a character in the game, controlled by the user.

          The player is located in: ${this.currentLocationPrompt(parameters)}

          The room is described as:
          ${room?.description}

          ${room?.myMysteryHints()}

          These people and entities are in the room:
          ${entityDescriptions}

          There are no people except those listed above (and the player ${this.name}).

          In this step YOUR ONLY JOB is to describe the object or space that the player is examining. If the player is not specific then describe the room generally.
          `,
        },
        ...this.historyForEntity(parameters, { limit: 4 }),
        {
          role: "user",
          content: tmpl`
          The player has asked for this to be described:
          \`${examine}\`

          Respond with:

          <description>1-2 paragraphs describing the thing</description>

          If examining the thing takes significant time then respond with:

          <description minutes="10">1-2 paragraphs describing a careful examination that takes time</description>
          `,
        },
      ],
    };
  }

  assembleMovePrompt(parameters: PlayerInputType): ChatType {
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
      messages: [
        {
          role: "system",
          content: tmpl`
          You are a computer assisting in running a text adventure game.

          The player ("${this.name}") is a character in the game, controlled by the user.

          The player is located in: ${this.currentLocationPrompt(parameters)}

          The player may go to any of these location:
          ${this.exitsPrompt(parameters)}

          In this step YOUR ONLY JOB is to describe the outcome of the player's movement attempt. If the player is not allowed to move to the location, you should describe why.
          `,
        },
        ...this.historyForEntity(parameters, { limit: 4 }),
        {
          role: "user",
          content: tmpl`
          The player has indicated they want to move to this location:
          \`${parameters.attemptMoveTo}\`

          There is a restriction on this exit: "${restriction}"

          Respond with:

          <description minutes="5">1-2 sentences describing the outcome of the move</description>

          minutes is how long the attempt took.

          IF the player is successful then also respond with:

          <goto success="true">${parameters.attemptMoveTo}</goto>

          Otherwise respond with:

          <goto success="false">${parameters.attemptMoveTo}</goto>
          `,
        },
      ],
    };
  }

  assembleActionPrompt(parameters: PlayerInputType): ChatType {
    const roll = this.world.model.roll();
    const room = this.world.entityRoom(this.id);
    let rollDescription = "";
    if (roll === 1) {
      rollDescription = "Critical failure!";
    } else if (roll === 20) {
      rollDescription = "Critical success!";
    }
    return {
      meta: {
        title: "player action",
      },
      messages: [
        {
          role: "system",
          content: tmpl`
          You are a computer assisting in running a text adventure game. You will act as an objective and fair game master.

          The genre is absurd and comedic sci-fi, in the style of Hitchhiker's Guide to the Galaxy or the movie Brazil.

          The player ("${this.name}") is a character in the game, controlled by the user.

          The player is located in: ${this.currentLocationPrompt(parameters)}

          The room is described as:
          ${room?.description}

          These people and entities are in the room:
          ${this.currentPeerEntitiesPrompt(parameters)}

          There are no people except those listed above (and the player ${this.name}).

          In this step YOUR ONLY JOB is to resolve an action the player is attempting to make. The action might be easy, or may be impossible, or somewhere in between.
          `,
        },
        ...this.historyForEntity(parameters, { limit: 4 }),
        {
          role: "user",
          content: tmpl`
          The player has indicated they want to take this action:
          \`${parameters.actionAttempt}\`

          [[The room has these notes about actions performed in the room, that may or may not be applicable:
          """
          ${room.actionPrompt}
          """]]

          They have rolled a d20 die (1=critical failure, 20=critical success) and the result is: ${roll}[[ (${rollDescription})]]

          Begin by thinking through your response given the history:

          <context>
          1. Is this action at all possible? Is it also an action that the player takes themselves?
          2. Is the action trivially easy? Opening doors, picking things up, or performing other simple actions should always succeed. If it is trivial then simply describe the successful outcome.
          3. What is the outcome if the action succeeds?
          4. What is the outcome if the action fails?
          5. What would make the action difficult or easy? Then rate it as VERY EASY, EASY, MEDIUM, HARD, VERY HARD.
          6. You may use the roll (${roll}) to determine if the action succeeds or fails, or you may decide the result based on plot or other factors. What do you choose? Is it successful?
          7. Do the instructions indicate any specific tags in case of success or failure?
          </context>

          After finishing <context></context> then write the result of the action:

          <actionResolution success="true/false" minutes="5">1-2 sentences describing the outcome of the action. Be CONCISE and DIRECT, do not add color to the user's action, using only dry and subtle humor to describe the effects</actionResolution>

          success="true" if it succeeds, "false" if it fails. minutes is how long the attempt took.

          Respond with the appropriate tags for this action attempt:
          \`${parameters.actionAttempt}\`
          `,
        },
      ],
    };
  }

  currentPeerEntitiesPrompt(parameters: PlayerInputType) {
    const room = this.world.entityRoom(this.id);
    const entities = this.world
      .entitiesInRoom(room)
      .filter((x) => x.id === "Ama" || (!x.invisible && x.id !== this.id));
    const entityLines: string[] = [];
    for (const entity of entities) {
      entityLines.push(`"${entity.name}" {`);
      if (isPerson(entity)) {
        entityLines.push(`  pronouns: ${entity.pronouns}`);
        entityLines.push(
          `  ${entity.promptPersonDescription({ includeName: false, join: "\n  ", fullDescription: true })}`
        );
      } else {
        entityLines.push(`  description: ${entity.description}`);
      }
      entityLines.push("}");
    }
    return entityLines.join("\n");
  }

  async processTag({
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
  }): Promise<StoryEventType> {
    if (tag.type === "goto") {
      const roomId = this.world.makeId(tag.content);
      const room = this.world.getRoom(roomId!);
      if (!room || !roomId) {
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
        const schedule = scheduleForTime(person, this.world.timestampMinutes);
        let extra = "";
        if (schedule) {
          if (schedule.inside.includes(room.id)) {
            extra = `\n    ${schedule.description}`;
          } else {
            extra = `\n    ${person.name} is on their way elsewhere`;
          }
        }
        peopleLines.push(
          `  ${person.name}: ${person.shortDescription}${extra}`
        );
      }
      const peopleDescription = folks.length
        ? await this.formatPeopleDescription(room, folks)
        : "";
      if (room.visits === 0) {
        storyEvent.actions.push({
          type: "description",
          text: tmpl`
            ==> ${room.name} <==
            ${room.description}

            ${peopleDescription}
            `,
        });
      } else if (room.visits < 4) {
        storyEvent.actions.push({
          type: "description",
          text: tmpl`
            ==> ${room.name}: ${room.shortDescription}

            ${peopleDescription}
            `,
        });
      } else {
        if (peopleDescription) {
          storyEvent.actions.push({
            type: "description",
            text: tmpl`
            ${peopleDescription}
            `,
          });
        } else {
          // FIXME: I can't figure out why this is necessary, but without it the indication that the player has moved doesn't show up
          storyEvent.actions.push({
            type: "description",
            text: "",
          });
        }
      }
    } else if (tag.type === "examine") {
      storyEvent.actionRequests = [
        ...(storyEvent.actionRequests || []),
        this.makePromptRequest({
          examine: tag.content,
        }),
      ];
    } else if (tag.type === "action") {
      storyEvent.actionRequests = [
        ...(storyEvent.actionRequests || []),
        this.makePromptRequest({
          actionAttempt: tag.content,
        }),
      ];
    } else if (tag.type === "actionResolution") {
      console.log(
        "handing action resolution",
        tag,
        coerceBoolean(tag.attrs.success, true)
      );
      storyEvent.actions.push({
        type: "actionAttempt",
        id: this.id,
        attempt: parameters.actionAttempt!,
        success: coerceBoolean(tag.attrs.success, true),
        minutes: coerceNumber(tag.attrs.minutes),
        resolution: tag.content,
      });
    }
    return storyEvent;
  }

  async formatPeopleDescription(room: Room, people: Person[]): Promise<string> {
    const sourceLines: string[] = [];
    for (const person of people) {
      const schedule = scheduleForTime(person, this.world.timestampMinutes);
      let text = `${person.name}: ${person.shortDescription}`;
      if (schedule) {
        if (schedule.inside.includes(room.id)) {
          text += ` Currently doing: ${schedule.description}`;
        } else {
          text += ` ${person.name} is on their way elsewhere`;
        }
      }
      sourceLines.push(text);
    }
    const resp = await chat({
      meta: {
        title: "describe people",
      },
      model: "flash",
      messages: [
        {
          role: "system",
          content: tmpl`
          You are helping run a text adventure game.

          The genre is absurd and comedic sci-fi, in the style of Hitchhiker's Guide to the Galaxy or the movie Brazil.

          You will be given a list of people and the activities they are doing. You will respond with a series of lines that describe everything that is happening (in about one sentence/line per person). You may group together people doing similar activities. There are no people in the room except those listed.

          Make sure to include all the names: ${people.map((x) => x.name).join(", ")} (you may reorder them to improve the flow of the paragraph)

          You will describe the people from the perspect of the player ("${this.name}") who is in the room with them.

          Keep the complete result under 500 characters.
          `,
        },
        {
          role: "user",
          content: sourceLines.join("\n"),
        },
      ],
    });
    return resp;
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

export type MysteryState = "veiled" | "available" | "revealed" | "solved";
export const MYSTERY_STATES: MysteryState[] = [
  "veiled",
  "available",
  "revealed",
  "solved",
];

export class Mystery extends Entity {
  type = "mystery";
  state: MysteryState = "veiled";
  resolution: string = "";
  // Should I put mysteries in a different room?
  inside = "Void";
  invisible = true;
  introduction = "";
  availableHints: Record<EntityId, string> = {};
  revealedHints: Record<EntityId, string> = {};
  solvedHints: Record<EntityId, string> = {};

  constructor({
    state,
    introduction,
    availableHints,
    revealedHints,
    solvedHints,
    ...props
  }: {
    state?: MysteryState;
    introduction?: string;
    availableHints?: Record<EntityId, string>;
    revealedHints?: Record<EntityId, string>;
    solvedHints?: Record<EntityId, string>;
  } & EntityInitType) {
    super(props);
    if (state) {
      this.state = state;
    }
    if (introduction) {
      this.introduction = introduction;
    }
    if (availableHints) {
      this.availableHints = availableHints;
    }
    if (revealedHints) {
      this.revealedHints = revealedHints;
    }
    if (solvedHints) {
      this.solvedHints = solvedHints;
    }
  }
}

function coerceBoolean(v: string, defaultValue = false) {
  v = v.toLowerCase();
  if (v === "true" || v === "yes" || v === "y" || v === "on" || v === "1") {
    return true;
  }
  if (v === "false" || v === "no" || v === "n" || v === "off" || v === "0") {
    return false;
  }
  console.warn("Unexpected boolean value:", JSON.stringify(v));
  return defaultValue;
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
  return llmText
    .replace(/…/g, "...")
    .replace(/&#x20;/g, " ")
    .trim();
}

function foldHistory(history: MessageType[]): MessageType[] {
  let found = false;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    if (prev.role === curr.role) {
      found = true;
      break;
    }
  }
  if (!found) {
    return history;
  }
  const newHistory: MessageType[] = [];
  for (let i = 0; i < history.length; i++) {
    const existing = newHistory.at(-1);
    if (!existing || existing.role !== history[i].role) {
      newHistory.push(history[i]);
      continue;
    }
    newHistory[newHistory.length - 1] = combineHistory(existing, history[i]);
  }
  return newHistory;
}

function combineHistory(a: MessageType, b: MessageType) {
  if (a.content && b.content) {
    if (b.content.includes(a.content)) {
      return b;
    } else if (a.content.includes(b.content)) {
      return a;
    }
    return {
      role: a.role,
      content: a.content + "\n\n" + b.content,
    };
  }
  if (a.content) {
    return a;
  }
  return b;
}

/* Sometimes the AI sets properties to specific values like 'unspecified' but that's not helpful */
function isValidPropertySet(entity: Entity, key: string, value: any) {
  if (typeof value !== "string") {
    return true;
  }
  const v = value.trim().toLowerCase();
  if (key === "pronouns") {
    return v === "he/him" || v === "she/her" || v === "they/them";
  } else if (key === "profession") {
    return v !== "unspecified" && v !== "unknown";
  } else if (key === "name") {
    return (
      v !== "unspecified" && v !== "unknown" && v !== "player" && v !== "you"
    );
  }
  return true;
}
