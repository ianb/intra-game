import { persistentSignal, SignalType } from "./persistentsignal";
import {
  EntityInteractionType,
  EntityType,
  GeminiHistoryType,
  InteractionType,
  isEntityInteraction,
  isStateUpdate,
  RoomType,
  SessionType,
  UpdateStreamType,
} from "./types";
import { chat } from "./llm";
import { parseTags, TagType } from "./parsetags";
import { rooms } from "./game/rooms";
import { entities } from "./game/entities";
import { fillTemplate, tmpl } from "./template";

const beginningInteraction: InteractionType = {
  activeEntityIds: ["entity:ama"],
  passiveEntityIds: [],
  roomId: "room:intake",
  inventory: {},
  availableAiIds: [],
  accessControl: {},
};

export class Model {
  session: SignalType<SessionType>;
  rooms: Record<string, RoomType> = {};
  entities: Record<string, EntityType> = {};

  constructor() {
    if (typeof window !== "undefined") {
      (window as any).model = this;
    }
    this.session = persistentSignal<SessionType>("session", {
      interaction: beginningInteraction,
      updates: [],
    });
    this.recalculateEntities();
  }

  reset() {
    this.session.value = {
      interaction: beginningInteraction,
      updates: [],
    };
    this.recalculateEntities();
    this.checkLaunch();
  }

  checkLaunch() {
    const room = this.rooms["room:intake"];
    console.log(
      "check launch",
      this.session.value.interaction.roomId,
      room.id,
      room.state.hasEntered
    );
    if (
      this.session.value.interaction.roomId === room.id &&
      !room.state.hasEntered
    ) {
      console.log("sendy");
      this.sendEvent("enter");
    }
  }

  async sendEvent(event: string) {
    const currentRoom = this.rooms[this.session.value.interaction.roomId];
    const entityIds = [
      ...this.session.value.interaction.activeEntityIds,
      ...this.session.value.interaction.passiveEntityIds,
    ];
    console.log("sending event", event, currentRoom, entityIds);
    if (currentRoom.onEvent) {
      await currentRoom.onEvent(event, this);
    }
    for (const entityId of entityIds) {
      const entity = this.entities[entityId];
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
      if (entityIds.includes(entity.id)) {
        continue;
      }
      if (entity.onGlobalEvent) {
        await entity.onGlobalEvent(event, this);
      }
    }
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
    if (isStateUpdate(update)) {
      this.recalculateEntities();
    }
  }

  recalculateEntities() {
    this.rooms = {};
    this.entities = {};
    for (const room of rooms) {
      this.rooms[room.id] = { ...room, state: { ...room.state } };
    }
    for (const entity of entities) {
      this.entities[entity.id] = {
        color: "",
        pronouns: "them/them",
        inventory: {},
        blipAis: {},
        roomAccess: {},
        ...entity,
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
          Object.assign(this.entities[update.id], update.updates);
          if (update.updates.name) {
            this.entities[update.id].name = update.updates.name;
          }
          if (update.updates.description) {
            this.entities[update.id].description = update.updates.description;
          }
          if (update.updates.pronouns) {
            this.entities[update.id].pronouns = update.updates.pronouns;
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
    }
  }

  async triggerPrompt(
    entityId: string,
    prompt: string,
    props?: Record<string, any>
  ) {
    const entity = this.entities[entityId];
    const promptEntry = Object.entries(entity.prompts || {}).find(
      ([_id, text]) => text === prompt
    );
    const promptTitle = promptEntry
      ? promptEntry[0]
      : prompt.slice(0, 10) + "...";
    const renderedPrompt = this.fillPrompt(prompt, entityId, props);
    console.log("rendered with props", props, [prompt, renderedPrompt]);
    const description = this.fillPrompt(entity.description, entityId, props);
    const resp = await chat({
      meta: {
        title: `${entityId.split(":")[1]}: ${promptTitle}`,
      },
      history: [
        {
          role: "user",
          text: tmpl`
          You will be running a text adventure game.

          For this step you will be playing the part of a character named "${entity.name}" (${entity.pronouns}).

          The character is described as:
          ${description}
          `,
        },
        ...this.historyForEntity(entity),
      ],
      message: tmpl`
      You will be continuing the game using this formatting:

      ${this.formatCommands(entity)}

      Continue the game with this in mind:
      ${renderedPrompt}
      `,
    });
    const tags = parseTags(resp);
    for (const tag of tags) {
      if (entity.onCommand) {
        entity.onCommand(tag, this);
      }
    }
    const interaction: EntityInteractionType = {
      type: "entityInteraction",
      entityId,
      response: resp,
      tags,
      inputVariables: props,
    };
    this.appendUpdate(interaction);
  }

  historyForEntity(perspective: EntityType): GeminiHistoryType[] {
    const updates = this.session.value.updates;
    const result: GeminiHistoryType[] = [];
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

  formatCommands(entity: EntityType) {
    const commands = entity.commands
      ? this.fillPrompt(entity.commands, entity.id)
      : "";
    return tmpl`
    ${commands}

    To speak as "${entity.name}" you can use the following command:

    <speak>Text to say</speak>

    To describe visible activities or pertinent visible results, use:

    <description>...</description>

    Reply with <thoughts>...</thoughts> to consider what ${entity.name} is thinking, then commands and <speak>...</speak> to act on those thoughts. Reply <noAction>...</noAction> to indicate that ${entity.name} is not taking any action.
    `;
  }

  async sendText(text: string) {
    const player = this.entities["entity:player"];
    await this.triggerPrompt("entity:player", player.prompts!.sendText, {
      text,
    });
    for (const entityId of this.session.value.interaction.activeEntityIds) {
      const entity = this.entities[entityId];
      if (entity.prompts?.reactToUser) {
        await this.triggerPrompt(entityId, entity.prompts.reactToUser);
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
      id = this.session.value.interaction.roomId;
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
        return obj;
      }
    }
    if (!obj) {
      console.warn(
        `Entity ${JSON.stringify(id)} not found: ${JSON.stringify(key)}`
      );
      return `<<${key}>>`;
    }
    if (!parts.length) {
      console.warn(`Object with no attributes: ${JSON.stringify(key)}`);
      return `<<${key}>>`;
    }
    let value = obj;
    for (const part of parts) {
      if (FUNCS[part]) {
        value = FUNCS[part](value);
        continue;
      }
      if (!value || !value[part]) {
        console.warn("Missing attribute", key, part, value);
        return undefined;
      }
      value = value[part];
    }
    return value;
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
};

export const model = new Model();
