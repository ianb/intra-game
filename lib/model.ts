import { persistentSignal, SignalType } from "./persistentsignal";
import {
  EntityInteractionType,
  EntityType,
  GeminiChatType,
  GeminiHistoryType,
  isEntityInteraction,
  isRoom,
  isStateUpdate,
  LlmErrorType,
  PromptChoiceType,
  RoomOrEntity,
  RoomType,
  SessionType,
  UpdateStreamType,
} from "./types";
import { chat, LlmError } from "./llm";
import { parseTags, TagType } from "./parsetags";
import { rooms } from "./game/rooms";
import { entities } from "./game/entities";
import {
  dedent,
  fillTemplate,
  TemplateFalse,
  TemplateTrue,
  tmpl,
} from "./template";

export class Model {
  session: SignalType<SessionType>;
  rooms: Record<string, RoomType> = {};
  entities: Record<string, EntityType> = {};
  lastSuggestions: string = "";

  constructor() {
    if (typeof window !== "undefined") {
      (window as any).model = this;
    }
    this.session = persistentSignal<SessionType>("session", {
      updates: [],
    });
    this.recalculateEntities();
  }

  get player() {
    return this.entities["entity:player"];
  }

  get(id: string): RoomOrEntity | undefined {
    if (id.startsWith("room:")) {
      return this.rooms[id];
    }
    if (id.startsWith("entity:")) {
      return this.entities[id];
    }
    return undefined;
  }

  containedIn(thing: string | RoomOrEntity): EntityType[] {
    if (typeof thing === "string") {
      thing = this.get(thing)!;
    }
    if (!thing) {
      throw new Error("Unknown thing");
    }
    const foundIds = new Set();
    const searchIds: string[] = [thing.id];
    const found: EntityType[] = [];
    while (searchIds.length) {
      const id = searchIds.pop()!;
      for (const entity of Object.values(this.entities)) {
        if (foundIds.has(entity.id)) {
          continue;
        }
        if (entity.locationId === id) {
          found.push(entity);
          foundIds.add(entity.id);
          searchIds.push(entity.id);
        }
      }
    }
    return found;
  }

  reset() {
    this.session.value = {
      updates: [],
    };
    this.recalculateEntities();
    this.checkLaunch();
  }

  checkLaunch() {
    const room = this.rooms["room:intake"];
    if (this.player.locationId === room.id && !room.state.hasEntered) {
      this.sendEvent("enter");
    }
  }

  async sendEvent(event: string) {
    const currentRoom = this.get(this.player.locationId) as RoomType;
    const entities = this.containedIn(currentRoom);
    console.log(
      "sending event",
      event,
      currentRoom,
      entities.map((e) => e.id)
    );
    if (currentRoom.onEvent) {
      await currentRoom.onEvent(event, this);
    }
    for (const entity of entities) {
      if (entity.onEvent) {
        await entity.onEvent(event, this);
      }
    }
    for (const room of Object.values(this.rooms)) {
      if (room === currentRoom) {
        continue;
      }
      if (room.onGlobalEvent) {
        await room.onGlobalEvent(event, this);
      }
    }
    for (const entity of Object.values(this.entities)) {
      if (entities.includes(entity)) {
        continue;
      }
      if (entity.onGlobalEvent) {
        await entity.onGlobalEvent(event, this);
      }
    }
  }

  async goToRoom(roomId: string) {
    const dest = this.rooms[roomId];
    if (!dest) {
      throw new Error(`Unknown room: ${roomId}`);
    }
    let visits = 0;
    for (const update of this.session.value.updates) {
      if (
        isStateUpdate(update) &&
        update.id === "entity:player" &&
        update.updates?.locationId === roomId
      ) {
        visits++;
      }
    }
    model.updateState("entity:player", {
      locationId: roomId,
    });
    if (visits === 0) {
      model.createNarration(tmpl`
      <description>
      ${dest.name}: ${dest.shortDescription}
      ${dest.description}
      </description>
      `);
    } else if (visits < 3) {
      model.createNarration(tmpl`
      <description>
      You go to ${dest.name}: ${dest.shortDescription}
      </description>
      `);
    }
    await this.triggerNearbyReaction();
  }

  updateState(id: string, updates: Record<string, any>) {
    this.appendUpdate({
      type: "stateUpdate",
      id,
      updates,
    });
  }

  appendUpdate(update: UpdateStreamType) {
    this.session.value = {
      ...this.session.value,
      updates: [...this.session.value.updates, update],
    };
    if (isStateUpdate(update) || isEntityInteraction(update)) {
      this.recalculateEntities();
    }
  }

  recalculateEntities() {
    this.rooms = {};
    this.entities = {};
    this.lastSuggestions = "";
    for (const room of rooms) {
      this.rooms[room.id] = {
        color: "",
        prompts: {},
        ...room,
        description: dedent(room.description),
        shortDescription: dedent(room.shortDescription),
        state: { ...room.state },
      };
    }
    for (const entity of entities) {
      this.entities[entity.id] = {
        color: "",
        pronouns: "them/them",
        inventory: {},
        blipAis: {},
        roomAccess: {},
        ...entity,
        description: dedent(entity.description),
        shortDescription: dedent(entity.shortDescription),
        roleplayInstructions: dedent(entity.roleplayInstructions),
        state: { ...entity.state },
      };
    }
    for (const update of this.session.value.updates) {
      if (isStateUpdate(update)) {
        if (update.id.startsWith("room:")) {
          Object.assign(this.rooms[update.id].state, update.updates);
          if (update.updates.name) {
            this.rooms[update.id].name = update.updates.name;
          }
          if (update.updates.description) {
            this.rooms[update.id].description = update.updates.description;
          }
        } else if (update.id.startsWith("entity:")) {
          Object.assign(this.entities[update.id].state, update.updates);
          if (update.updates.name) {
            this.entities[update.id].name = update.updates.name;
          }
          if (update.updates.description) {
            this.entities[update.id].description = update.updates.description;
          }
          if (update.updates.pronouns) {
            this.entities[update.id].pronouns = update.updates.pronouns;
          }
          if (update.updates.locationId) {
            this.entities[update.id].locationId = update.updates.locationId;
          }
          if (update.updates.inventory) {
            Object.assign(
              this.entities[update.id].inventory,
              update.updates.inventory
            );
            deleteEmpty(this.entities[update.id].inventory);
          }
          if (update.updates.blipAis) {
            Object.assign(
              this.entities[update.id].blipAis,
              update.updates.blipAis
            );
            deleteEmpty(this.entities[update.id].blipAis);
          }
          if (update.updates.roomAccess) {
            Object.assign(
              this.entities[update.id].roomAccess,
              update.updates.roomAccess
            );
            deleteEmpty(this.entities[update.id].roomAccess);
          }
        } else {
          console.error("Unknown update", update);
        }
      }
      if (isEntityInteraction(update)) {
        const tags = update.tags.filter((tag) => tag.type === "suggestion");
        if (tags.length) {
          this.lastSuggestions = tags.map((tag) => tag.content).join("\n");
        }
      }
    }
  }

  async triggerReaction(entityId: string, props?: Record<string, any>) {
    const entity = this.entities[entityId];
    const player = this.entities["entity:player"];
    let promptChoice: PromptChoiceType = { id: "reactToUser" };
    if (entity.choosePrompt) {
      promptChoice = entity.choosePrompt(this, props || {});
    }
    props = { ...promptChoice.props, ...props };
    const prompt = entity.prompts[promptChoice.id];
    const twoPartPrompt = this.fillPrompt(prompt, entityId, props);
    const parts = twoPartPrompt.split(/>>>\s*user/);
    const renderedPrompt = parts[0].trim();
    const extraUserPrompt = (parts[1] || "").trim();
    const roleplaying = this.fillPrompt(
      entity.roleplayInstructions,
      entityId,
      props
    );
    const description = this.fillPrompt(entity.description, entityId, props);
    const fullPrompt: GeminiChatType = {
      meta: {
        title: `${entityId.split(":")[1]}: ${promptChoice.id}`,
      },
      systemInstruction: tmpl`
      You are helping write out a text adventure game.

      For the next step you will be playing the part of a character named "${entity.name}" (${entity.pronouns}).

      You will be provided with a history of the gameplay up to this point.

      The character ${entity.name} is described as:
      """
      ${description}
      """

      The player character is ${player.name} (${player.pronouns}). Anything in <speak character="${player.name}">...</speak> is from the player character, and written (perhaps indirectly) by the user.

      To continue the play you will be using this formatting in the text you generate:

      ${this.formatCommands(entity, props)}

      [[When writing dialog or considering actions for the character, note these roleplaying notes:
      ${roleplaying}]]

      Instructions on how to play the character follow:

      ${renderedPrompt}
      `,
      history: [...this.historyForEntity(entity)],
      message: tmpl`
      Continue the game as ${entity.name}

      ${extraUserPrompt}
      `,
    };
    let resp: string;
    try {
      resp = await chat(fullPrompt);
    } catch (e) {
      if (e instanceof LlmError) {
        const error: LlmErrorType = {
          type: "llmError",
          context: `${props.text ? `Input ${JSON.stringify(props.text)} ` : ""} ${fullPrompt.meta.title}`,
          description: e.describe(),
        };
        this.appendUpdate(error);
        return;
      }
      throw e;
    }
    const tags = parseTags(resp);
    const interaction: EntityInteractionType = {
      type: "entityInteraction",
      entityId,
      response: resp,
      tags,
      inputVariables: props,
    };
    this.appendUpdate(interaction);
    for (const tag of tags) {
      if (entity.onCommand) {
        await entity.onCommand(tag, this);
      }
    }
  }

  historyForEntity(perspective: EntityType): GeminiHistoryType[] {
    const updates = this.session.value.updates;
    let result: GeminiHistoryType[] = [];
    for (const update of updates) {
      if (isEntityInteraction(update)) {
        const isEntity = update.entityId === perspective.id;
        const thisEntity = this.entities[update.entityId];
        const parts = update.tags.map((tag) => {
          if (tag.type === "description") {
            return `<description>${tag.content}</description>`;
          }
          if (tag.type === "speak") {
            return `<speak character="${thisEntity.name}">${tag.content}</speak>`;
          }
          if (tag.type === "thoughts" && isEntity) {
            return `<thoughts character="${thisEntity.name}">${tag.content}</thoughts>`;
          }
          return "";
        });
        const fullParts = parts.join("\n\n").trim();
        if (!fullParts) {
          continue;
        }
        if (thisEntity.id === "entity:player") {
          result.push({
            role: "user",
            text: fullParts,
          });
        } else {
          result.push({
            role: "model",
            text: fullParts,
          });
        }
      }
    }
    if (perspective.id === "entity:player") {
      result = result.slice(-5);
    }
    if (result.length && result[0].role !== "user") {
      // Gemini is picky about this
      result.unshift({
        role: "user",
        text: "<beginStory></beginStory>",
      });
    }
    return result;
  }

  createNarration(text: string) {
    const rendered = this.fillPrompt(text, "entity:narrator");
    const interaction: EntityInteractionType = {
      type: "entityInteraction",
      entityId: "entity:narrator",
      response: rendered,
      tags: parseTags(rendered),
    };
    this.appendUpdate(interaction);
  }

  formatCommands(entity: EntityType, props: Record<string, any>) {
    const commands = entity.commands
      ? this.fillPrompt(entity.commands, entity.id, props)
      : "";
    return tmpl`
    ${commands}

    [[${coerceVar(!entity.cannotSpeak)} To speak as "${entity.name}" you can use the following command (do not nest <speak> tags!):

    <speak character="${entity.name}">Text to say</speak>]]

    [[${coerceVar(!entity.cannotDescribe)} To describe visible activities or pertinent visible results, use:

    <description>...</description>]]

    [[${coerceVar(!entity.cannotThink)} First emit <thoughts>...</thoughts> to consider what ${entity.name} is thinking.]]
    [[${coerceVar(!entity.cannotSpeak)} Emit <speak character="${entity.name}">...</speak> write dialog for the character.]]
    Reply <noAction>...</noAction> to indicate that ${entity.name} is not taking any action. Do not improvise any other tags.

    Finally conclude with 2 suggestions for how the player may wish to reply. The two replies should be different and should not reveal any special information, but follow naturally from the situation. A command is typically 1-3 words (full grammar is not required!) Write these like:

    <suggestion>
    Punch him in face
    </suggestion>

    <suggestion>
    Go cafeteria
    </suggestion>

    ---
    `;
  }

  async sendText(text: string) {
    const player = this.entities["entity:player"];
    await this.triggerReaction("entity:player", {
      text,
    });
    const entities = this.containedIn(this.get(player.locationId) as RoomType);
    for (const entity of entities) {
      if (entity.prompts?.reactToUser !== undefined) {
        await this.triggerReaction(entity.id);
      }
    }
  }

  async triggerNearbyReaction(props?: Record<string, any>) {
    const SKIP_IDS = ["entity:player", "entity:narrator"];
    const entities = this.containedIn(
      this.get(this.player.locationId) as RoomType
    );
    for (const entity of entities) {
      if (SKIP_IDS.includes(entity.id)) {
        continue;
      }
      if (entity.prompts?.reactToUser !== undefined) {
        await this.triggerReaction(entity.id, props);
      }
    }
  }

  undo(): string {
    const updates = [...this.session.value.updates];
    while (updates.length && !isUserInput(updates.at(-1)!)) {
      updates.pop();
    }
    let lastInput = "";
    while (updates.length && isUserInput(updates.at(-1)!)) {
      const update = updates.pop()!;
      lastInput = (update as EntityInteractionType).inputVariables?.text || "";
    }
    this.session.value = {
      ...this.session.value,
      updates,
    };
    this.recalculateEntities();
    this.checkLaunch();
    return lastInput;
  }

  fillPrompt(
    prompt: string,
    defaultEntityId: string,
    props?: Record<string, any>
  ) {
    props = props || {};
    const rendered = fillTemplate(
      prompt,
      this._promptEval.bind(this, defaultEntityId, props)
    );
    return rendered;
  }

  _promptEval(
    defaultEntityId: string,
    variables: Record<string, any>,
    key: string
  ) {
    const parts = key.split(".");
    let id = defaultEntityId;
    if (
      parts[0].includes(":") ||
      parts[0] === "pc" ||
      parts[0] === "currentLocation" ||
      variables[parts[0]]
    ) {
      id = parts.shift()!;
    }
    if (id === "pc") {
      id = "entity:player";
    }
    if (id === "currentLocation") {
      id = this.player.locationId;
    }
    console.log("Prompt eval", [key, id, parts]);
    let obj: any;
    if (id.startsWith("room:")) {
      obj = this.rooms[id];
    } else if (id.startsWith("entity:")) {
      obj = this.entities[id];
    } else if (variables[id]) {
      obj = variables[id];
      if (!parts.length) {
        return coerceVar(obj);
      }
    }
    if (!obj) {
      console.warn(
        `Entity ${JSON.stringify(id)} not found: ${JSON.stringify(key)}`
      );
      return undefined;
    }
    if (!parts.length) {
      console.warn(`Object with no attributes: ${JSON.stringify(key)}`);
      return undefined;
    }
    let value = obj;
    for (const part of parts) {
      if (FUNCS[part]) {
        value = FUNCS[part](value);
        continue;
      }
      if (
        value &&
        value[part] === undefined &&
        value.state &&
        value.state[part] !== undefined
      ) {
        if (typeof value.state[part] === "function") {
          value = value.state[part].bind(value);
          value = value({
            defaultEntityId,
            model: this,
          });
        } else {
          value = value.state[part];
        }
        continue;
      }
      if (!value || value[part] === undefined) {
        console.warn("Missing attribute", key, part, value);
        return undefined;
      }
      value = value[part];
    }
    return coerceVar(value);
  }
}

function isUserInput(update: UpdateStreamType) {
  return isEntityInteraction(update) && update.entityId === "entity:player";
}

function deleteEmpty(obj: Record<string, any>) {
  for (const key of Object.keys(obj)) {
    if (!obj[key]) {
      delete obj[key];
    }
  }
}

const FUNCS: Record<string, (obj: any) => any> = {
  nameIntro(obj: any) {
    return `${obj.name} (${obj.pronouns})`;
  },
  exitList(obj: RoomType) {
    if (!obj.exits.length) {
      return "There are no exits.";
    }
    const lines: string[] = [];
    for (const exit of obj.exits) {
      let name = exit.name;
      if (!name) {
        const room = model.rooms[exit.roomId];
        name = room.name;
      }
      lines.push(`"${name}" locationId: "${exit.roomId}"`);
      if (exit.restriction) {
        lines.push(`  (with the restriction: ${exit.restriction})`);
      }
    }
    return lines.join("\n");
  },
  not(obj: any) {
    if (obj && obj.isEmpty) {
      return true;
    }
    if (Array.isArray(obj)) {
      return !obj.length;
    }
    if (obj && typeof obj === "object") {
      return Object.keys(obj).length === 0;
    }
    return !obj;
  },
  nearby(obj: RoomOrEntity) {
    const SKIP_IDS = ["entity:player", "entity:narrator", "entity:ama"];
    const room = isRoom(obj) ? obj : model.rooms[obj.locationId];
    const entities = model
      .containedIn(room)
      .filter((e) => e !== obj && !SKIP_IDS.includes(e.id));
    return entities;
  },
  shortDescription(items: RoomOrEntity | RoomOrEntity[]) {
    if (!Array.isArray(items)) {
      items = [items];
    }
    return items
      .map(
        (item) =>
          `${item.name}${isRoom(item) ? " (the room)" : ""}: ${item.shortDescription}`
      )
      .join("\n");
  },
};

function coerceVar(value: any) {
  if (value === true) {
    return TemplateTrue;
  }
  if (value === false) {
    return TemplateFalse;
  }
  return value;
}

export const model = new Model();
