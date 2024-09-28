import { persistentSignal, SignalType } from "./persistentsignal";
import {
  EntityInteractionType,
  EntityType,
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
import { tmpl } from "./template";

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
      this.entities[entity.id] = { ...entity, state: { ...entity.state } };
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
        } else {
          console.error("Unknown update", update);
        }
      }
    }
  }

  async triggerPrompt(entityId: string, prompt: string) {
    const entity = this.entities[entityId];
    const promptId = Object.entries(entity.prompts || {}).filter(
      ([_id, text]) => text === prompt
    )?.[0];
    const resp = await chat({
      meta: {
        title: `${entityId.split(":")[1]}: ${promptId}`,
      },
      history: [
        {
          role: "user",
          text: tmpl`
          You will be running a text adventure game.

          For this step you will be playing the part of a character named "${entity.name}".

          The character is described as:
          ${entity.description}
          `,
        },
      ],
      message: tmpl`
      Continue the game with this in mind:
      ${prompt}

      ${this.formatCommands(entity)}
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
    };
    this.appendUpdate(interaction);
  }

  formatCommands(entity: EntityType) {
    return tmpl`
    ${entity.commands || ""}

    To speak as "${entity.name}" you can use the following command:

    <speak>Text to say</speak>

    Reply with <thoughts>...</thoughts> to consider what ${entity.name} is thinking, then commands and <speak>...</speak> to act on those thoughts. Reply <noAction>...</noAction> to indicate that ${entity.name} is not taking any action.
    `;
  }

  async sendText(text: string) {
    console.log("Sending text", text);
    const result = await chat({
      meta: {
        title: "Gemini",
      },
      model: "gemini-1.5-flash",
      history: [],
      message: text,
    });
    console.log("Result", result);
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
}

function isUserInput(update: UpdateStreamType) {
  return isEntityInteraction(update) && update.entityId === "entity:player";
}

export const model = new Model();
