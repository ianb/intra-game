import type { Entity, Room, Person } from "./classes";
import {
  EntityId,
  isPerson,
  isRoom,
  PersonScheduledEventType,
  StoryEventType,
} from "../types";
import type { AllEntitiesType, AllMysteriesType } from "./gameobjs";
import type { Model } from "./model";
import { tmpl } from "../template";
import colors from "tailwindcss/colors";
import { generateExactSchedule, timeAsString } from "./scheduler";

export const ONE_DAY = 24 * 60;

export class World {
  entities: AllEntitiesType;
  original: AllEntitiesType;
  rooms: string[];
  lastSuggestions: string = "";
  model: Model;
  // Minutes since Midnight the day the game starts
  timestampMinutes: number = 10 * 60; // 10am
  nameRegex!: RegExp;

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

  getPerson(personId: string): Person | null {
    const person = this.getEntity(personId);
    if (!person) {
      return null;
    }
    if (!isPerson(person)) {
      console.error("Tried to get entity as person:", personId, person);
      return null;
    }
    return person;
  }

  allPeople(): Person[] {
    return Object.values(this.entities).filter(isPerson);
  }

  allRooms(): Room[] {
    return Object.values(this.entities).filter(isRoom);
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

  entityRoom(entityId: string): Room {
    const entity = this.getEntity(entityId);
    if (!entity) {
      throw new Error(`No entity with id "${entityId}"`);
    }
    let pos = entity;
    while (pos && !isRoom(pos)) {
      if (!pos.inside) {
        return this.entities.Void;
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
      return this.entities.Void;
    }
    return pos;
  }

  initWorld() {
    const regexParts: string[] = [];
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
        for (const s of obj.scheduleTemplate || []) {
          const insides = Array.isArray(s.inside) ? s.inside : [s.inside];
          for (const inside of insides) {
            if (!(this.original as any)[inside]) {
              throw new Error(
                `Person ${obj.id} has schedule entry with inside ${inside} which does not exist`
              );
            }
          }
        }
        regexParts.push(obj.name);
      }
    }
    this.nameRegex = new RegExp(
      `(^|[^a-zA-Z])(${regexParts.join("|")})([^a-zA-Z]|$)`,
      "ig"
    );
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
    this.timestampMinutes += storyEvent.totalTime;
  }

  asGraphviz(fullMap: boolean = false) {
    const roomList: string[] = [];
    const connectionList: string[] = [];
    const playerRoom = this.entityRoom("player");
    if (window !== undefined) {
      (window as any).colors = colors;
    }
    const allRooms = this.rooms.filter((room) => {
      return !this.getRoom(room)?.excludeFromMap && room !== playerRoom.id;
    });
    let rooms = allRooms;
    const skipExits: string[] = [];
    if (!fullMap) {
      rooms = [];
      for (const room of this.rooms) {
        const roomObj = this.getRoom(room);
        if (!roomObj) {
          throw new Error(`No room with id: ${room}`);
        }
        if (roomObj.excludeFromMap && playerRoom.id !== roomObj.id) {
          continue;
        }
        if (roomObj.visits > 0) {
          rooms.push(room);
        }
      }
    }
    for (const room of [...rooms]) {
      for (const exit of this.getRoom(room)?.exits || []) {
        if (
          this.getRoom(exit.roomId)?.excludeFromMap &&
          playerRoom.id !== exit.roomId
        ) {
          continue;
        }
        if (!rooms.includes(exit.roomId)) {
          rooms.push(exit.roomId);
          skipExits.push(exit.roomId);
        }
      }
    }
    for (const room of rooms) {
      const roomObj = this.getRoom(room);
      if (!roomObj) {
        throw new Error(`No room with id: ${room}`);
      }
      const colorName = roomObj.color || "text-white";
      const color = this._convertColorName(colorName);
      const occupants = skipExits.includes(room)
        ? []
        : this.entitiesInRoom(roomObj).map((entity) => entity.name);
      const headerColor = skipExits.includes(room) ? "black" : "white";
      const lines = [`<TABLE BORDER="0">`];
      lines.push(
        `<TR><TD ALIGN="CENTER"><FONT COLOR="${headerColor}"><B>${roomObj.name}</B></FONT></TD></TR>`
      );
      for (const occupant of occupants) {
        if (!occupant) {
          continue;
        }
        lines.push(
          `<TR><TD ALIGN="LEFT"><FONT COLOR="white" POINT-SIZE="8">${occupant}</FONT></TD></TR>`
        );
      }
      lines.push("</TABLE>");
      const shape =
        playerRoom!.id == roomObj.id
          ? '  shape=box, peripheries=2, color="white",'
          : "";
      roomList.push(
        tmpl`
        ${roomObj.id} [
          ${shape}
          label=<${lines.join("\n")}>,
          fillcolor="${color}",
          style="filled",
        ];
      `
      );
      if (!skipExits.includes(room)) {
        for (const exit of roomObj.exits) {
          if (
            this.getRoom(exit.roomId)?.excludeFromMap &&
            playerRoom.id !== exit.roomId
          ) {
            continue;
          }
          connectionList.push(
            tmpl`
          ${roomObj.id} -> ${exit.roomId};
        `
          );
        }
      }
    }
    return tmpl`
      digraph G {
        label="The Intra Complex";
        labelloc="t";
        labeljust="r";
        fontname="Helvetica";
        fontcolor="white";
        fontsize=13;
        bgcolor="#111827";
        edge [color="white"];
        node [shape=record, style=filled, fontsize=12, fontname="Helvetica"];

        ${roomList.join("\n")}

        ${connectionList.join("\n")}
      }
    `;
  }

  _convertColorName(color: string) {
    const c = color.replace(/^text-/, "");
    const parts = c.split("-");
    let pos: any = colors;
    for (const part of parts) {
      if (pos) {
        pos = (pos as any)[part];
      }
    }
    if (!pos) {
      console.warn("Could not find color", color);
      return "1.0 1.0 1.0";
    }
    return pos;
  }

  setupDailySchedules(): Record<EntityId, PersonScheduledEventType[]> {
    const result: Record<EntityId, PersonScheduledEventType[]> = {};
    for (const entity of Object.values(this.entities)) {
      if (isPerson(entity)) {
        const template = entity.scheduleTemplate || [];
        const schedule = generateExactSchedule(template);
        if (schedule.length > 0) {
          result[entity.id] = schedule;
        }
      }
    }
    return result;
  }

  get timeOfDay(): string {
    return timeAsString(this.timestampMinutes);
  }

  get timestampOfDay(): number {
    return this.timestampMinutes % ONE_DAY;
  }

  /* This will ONLY return a valid id, or null
     If the given name isn't already an id, it will search
     for entities with that name (case insensitive)
     */
  makeId(name: string | null): EntityId | null {
    if (!name) {
      return null;
    }
    if ((this.entities as any)[name]) {
      return name;
    }
    const lowerName = normalizeName(name);
    for (const [key, entity] of Object.entries(this.entities)) {
      if (normalizeName(entity.name) === lowerName) {
        return key;
      }
    }
    for (const [key, entity] of Object.entries(this.entities)) {
      if (
        normalizeName(entity.name).includes(lowerName) ||
        normalizeName(entity.id).includes(lowerName)
      ) {
        return key;
      }
    }
    if (lowerName === "you") {
      return "player";
    }
    return null;
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s\s+/g, " ")
    .replace("é", "e")
    .replace(/\s/g, "_")
    .trim();
}
