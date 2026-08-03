import {
  EntityId,
  isPerson,
  isRoom,
  isMystery,
  PersonScheduledEventType,
  StoryEventType,
  TodoType,
  TodoUpdateType,
} from "../types";
import { tmpl } from "../template";
import type { Entity, Room, Person, Mystery } from "./classes";
import type { AllEntitiesType } from "./content";
import type { Model } from "./model";
import { generateExactSchedule, timeAsString } from "./scheduler";
import { entitiesById } from "./dynamic";
import { applyTodoUpdates, todoId } from "./todos";

export const ONE_DAY = 24 * 60;

export class World {
  entities: AllEntitiesType;
  original: AllEntitiesType;
  rooms: string[];
  lastSuggestions: string = "";
  /** The player's task list, folded out of the log; see game/todos.ts. */
  todos: TodoType[] = [];
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
    return entitiesById(this.entities)[entityId] || null;
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

  allMysteries(): Mystery[] {
    return Object.values(this.entities).filter(isMystery) as Mystery[];
  }

  getMystery(mysteryId: string): Mystery | null {
    const mystery = this.getEntity(mysteryId);
    if (!mystery) {
      return null;
    }
    if (!isMystery(mystery)) {
      console.error("Tried to get entity as mystery:", mysteryId, mystery);
      return null;
    }
    return mystery;
  }

  unveiledMysteries() {
    return this.allMysteries().filter((m) => m.state !== "veiled");
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
      this.isInside(entity, room),
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
          `Entity ${entity.id} is inside ${entity.inside} but ${entity.inside} does not exist`,
        );
      }
    }
    return false;
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
          `Entity ${entityId} is inside ${pos.id}->${pos.inside} but ${pos.inside} does not exist `,
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
      if (obj.inside && !entitiesById(this.original)[obj.inside]) {
        throw new Error(
          `Object ${key} is inside ${obj.inside} which does not exist`,
        );
      }
      if (isRoom(obj)) {
        this.rooms.push(obj.id);
        regexParts.push(obj.name);
        for (const exit of obj.exits) {
          if (!entitiesById(this.original)[exit.roomId]) {
            throw new Error(
              `Room ${obj.id} has exit to ${exit.roomId} which does not exist`,
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
        } else if (!entitiesById(this.original)[inside]) {
          throw new Error(
            `Person ${obj.id} is inside ${JSON.stringify(inside)} which does not exist`,
          );
        }
        for (const s of obj.scheduleTemplate || []) {
          const insides = Array.isArray(s.inside) ? s.inside : [s.inside];
          for (const inside of insides) {
            if (!entitiesById(this.original)[inside]) {
              throw new Error(
                `Person ${obj.id} has schedule entry with inside ${inside} which does not exist`,
              );
            }
          }
        }
        regexParts.push(obj.name);
      }
      if (isMystery(obj)) {
        for (const hint of [obj.availableHints, obj.revealedHints]) {
          for (const key of Object.keys(hint)) {
            if (key === "*") {
              continue;
            }
            if (!entitiesById(this.original)[key]) {
              throw new Error(
                `Mystery ${obj.id} has hint ${key} which does not exist`,
              );
            }
          }
        }
      }
    }
    // Longest first, so a name that contains a shorter one (e.g. "Intake
    // Foyer" and "Intake") matches the longer whole rather than its prefix.
    regexParts.sort((a, b) => b.length - a.length);
    // the fixed set of entity names defined in content/, not from user input.
    // eslint-disable-next-line security/detect-non-literal-regexp -- built from
    this.nameRegex = new RegExp(
      `(^|[^a-zA-Z])(${regexParts.join("|")})([^a-zA-Z]|$)`,
      "ig",
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
    for (const update of this.model.liveUpdates.value) {
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
        entityId === "PLAYER" &&
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
    // A mystery arriving or being solved is the clearest "something concrete
    // happened" the game has, and until now it touched nothing the player could
    // see except a panel most of them never open. The task list is exactly the
    // right place for it, and was sitting unused: the `briefed` checkpoint —
    // Ama handing over the whole Ink and Echo mystery — recorded no tasks at
    // all, and three full quest playthroughs produced none between them.
    //
    // Derived here in the fold rather than asked of the model, because the
    // model already declines to do it, and because this way it replays
    // identically from any checkpoint.
    const fromMysteries = mysteryTodos(storyEvent, this);
    if (storyEvent.todos?.length || fromMysteries.length) {
      this.todos = applyTodoUpdates(this.todos, {
        ...storyEvent,
        todos: [...fromMysteries, ...(storyEvent.todos || [])],
      });
    }
    this.timestampMinutes += storyEvent.totalTime;
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
  makeId(name: string | null | undefined): EntityId | null {
    if (!name) {
      return null;
    }
    if (entitiesById(this.entities)[name]) {
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
      return "PLAYER";
    }
    return null;
  }
}

/**
 * Task-list updates implied by a mystery changing state in this event.
 *
 * The mystery's `name` is already the question the player is chasing ("Who is
 * writing notes as 'Ink and Echo'?"), so it needs no new prose: revealing puts
 * it on the list, solving crosses it off. Model-written tasks in the same event
 * win, since a character phrasing it in their own words is better than this.
 */
function mysteryTodos(
  storyEvent: StoryEventType,
  world: World,
): TodoUpdateType[] {
  const updates: TodoUpdateType[] = [];
  for (const [entityId, change] of Object.entries(storyEvent.changes)) {
    const state = change.after?.state;
    if (state === undefined || state === change.before?.state) {
      continue;
    }
    const mystery = world.getEntity(entityId);
    if (!mystery || !isMystery(mystery)) {
      continue;
    }
    // Only revealed and solved reach the list. `available` means the game
    // will answer if asked but has not raised the subject — putting it on the
    // task list would be the game raising the subject. No mystery entered
    // `available` during play until the sealed door, so this was checked as
    // `!== "veiled"` and never mattered.
    if (state !== "revealed" && state !== "solved") {
      continue;
    }
    updates.push({
      id: todoId(mystery.name),
      title: mystery.name,
      done: state === "solved",
      // So the list can show how it concluded, which is what the separate
      // mysteries panel used to be for.
      from: entityId,
    });
  }
  return updates;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s\s+/g, " ")
    .replace("é", "e")
    .replace(/\s/g, "_")
    .trim();
}
