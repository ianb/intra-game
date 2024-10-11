import type { Entity, Room } from "./classes";
import { isPerson, isRoom, StoryEventType } from "../types";
import type { AllEntitiesType } from "./gameobjs";
import type { Model } from "./model";

export class World {
  entities: AllEntitiesType;
  original: AllEntitiesType;
  rooms: string[];
  lastSuggestions: string = "";
  model: Model;

  constructor({
    entities,
    original,
    model,
  }: {
    entities?: AllEntitiesType;
    original: AllEntitiesType;
    model: Model;
  }) {
    this.entities = entities || original;
    this.original = original;
    this.rooms = [];
    this.model = model;
    this.initWorld();
  }

  getEntity(entityId: string): Entity | null {
    return (this.entities as any)[entityId] || null;
  }

  getRoom(roomId: string): Room | null {
    const room = this.getEntity(roomId);
    if (!room) {
      return null;
    }
    if (!isRoom(room)) {
      console.error("Tried to get entity as room:", roomId, room);
      return null;
    }
    return room;
  }

  entitiesInRoom(room: string | Room): Entity[] {
    if (typeof room === "string") {
      const aRoom = this.getRoom(room);
      if (!aRoom) {
        throw new Error(`No room with id: ${room}`);
      }
      room = aRoom;
    }
    return Object.values(this.entities).filter((entity) =>
      this.isInside(entity, room)
    );
  }

  isInside(entity: Entity | string, container: Entity | string) {
    if (typeof entity === "string") {
      entity = this.getEntity(entity)!;
      if (!entity) {
        throw new Error(`No entity with id: ${entity}`);
      }
    }
    if (typeof container === "string") {
      container = this.getEntity(container)!;
      if (!container) {
        throw new Error(`No room with id: ${container}`);
      }
    }
    let pos = entity;
    while (pos) {
      if (pos.inside === container.id) {
        return true;
      }
      if (!pos.inside) {
        return false;
      }
      pos = this.getEntity(pos.inside)!;
      if (!pos) {
        throw new Error(
          `Entity ${entity.id} is inside ${entity.inside} but ${entity.inside} does not exist`
        );
      }
    }
  }

  entityRoom(entityId: string): Room | null {
    const entity = this.getEntity(entityId);
    if (!entity) {
      throw new Error(`No entity with id "${entityId}"`);
    }
    let pos = entity;
    while (pos && !isRoom(pos)) {
      if (!pos.inside) {
        return null;
      }
      const nextPos = this.getEntity(pos.inside);
      if (!nextPos) {
        throw new Error(
          `Entity ${entityId} is inside ${pos.id}->${pos.inside} but ${pos.inside} does not exist `
        );
      }
      pos = nextPos;
    }
    if (!pos) {
      return null;
    }
    return pos;
  }

  initWorld() {
    for (const [key, obj] of Object.entries(this.original)) {
      if (obj.id !== key) {
        throw new Error(`Object id ${obj.id} does not match key ${key}`);
      }
      obj.world = this;
      if (obj.inside && !(this.original as any)[obj.inside]) {
        throw new Error(
          `Object ${key} is inside ${obj.inside} which does not exist`
        );
      }
      if (isRoom(obj)) {
        this.rooms.push(obj.id);
        for (const exit of obj.exits) {
          if (!(this.original as any)[exit.roomId]) {
            throw new Error(
              `Room ${obj.id} has exit to ${exit.roomId} which does not exist`
            );
          }
        }
      }
      if (isPerson(obj)) {
        const inside = obj.inside;
        if (!inside) {
          throw new Error(`Person ${obj.id} has no inside`);
        } else if (inside === "Void") {
          console.error("Person", obj.id, "is in Void");
        } else if (!(this.original as any)[inside]) {
          throw new Error(
            `Person ${obj.id} is inside ${JSON.stringify(inside)} which does not exist`
          );
        }
      }
    }
    this.applyUpdates();
  }

  applyUpdates() {
    const newEntities: Record<string, Entity> = {};
    for (const [key, obj] of Object.entries(this.original)) {
      newEntities[key] = obj.clone();
      newEntities[key].world = this;
    }
    this.entities = newEntities as AllEntitiesType;
    for (const update of this.model.updates.value) {
      this.applyStoryEvent(update);
    }
  }

  applyStoryEvent(storyEvent: StoryEventType) {
    for (const [entityId, changes] of Object.entries(storyEvent.changes)) {
      const entity = this.getEntity(entityId);
      if (!entity) {
        console.warn(`Update for entity ${entityId} which does not exist`);
        continue;
      }
      entity.applyChange(changes);
      if (
        entityId === "player" &&
        changes.after.inside &&
        changes.before.inside !== changes.after.inside
      ) {
        const room = this.entityRoom(changes.after.inside);
        if (room) {
          room.visits++;
        }
      }
    }
    if (storyEvent.suggestions) {
      this.lastSuggestions = storyEvent.suggestions;
    }
  }
}
