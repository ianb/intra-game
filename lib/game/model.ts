import { persistentSignal, SignalType } from "../persistentsignal";
import { TrackSettled } from "../tracksettled";
import { ActionRequestType, isPromptRequest, isStoryEvent } from "../types";
import { StoryEventType } from "../types";
import { World } from "./world";
import { AllEntitiesType, entities } from "./gameobjs";
import { listSaves, load, removeSave, save } from "../localsaves";
import { scheduleForTime } from "./scheduler";
import type { Person, StoryEventWithPositionsType } from "../types";
import { pathTo } from "./pathto";
import { computed } from "@preact/signals-react";

export class Model {
  updates: SignalType<StoryEventType[]>;
  world: World;
  promiseQueue: TrackSettled;
  updatesWithPositions: SignalType<StoryEventWithPositionsType[]>;

  constructor(startingEntities: AllEntitiesType) {
    if (typeof window !== "undefined") {
      (window as any).model = this;
    }
    this.promiseQueue = new TrackSettled();
    this.updates = persistentSignal<StoryEventType[]>("updates", []);
    this.updatesWithPositions = computed(() => this._eventsWithPositions());
    this.world = new World({
      original: startingEntities,
      model: this,
    });
  }

  get runningSignal() {
    return this.promiseQueue.runningSignal;
  }

  run(func: () => Promise<any>) {
    return this.promiseQueue.run(func);
  }

  reset() {
    this.updates.value = [];
    this.world = new World({
      original: this.world.original,
      model: this,
    });
    this.checkLaunch();
  }

  async scheduleTick() {
    const allChanges: any = {};
    // All the people with schedules, and no change in which schedule:
    const existingPeople: Person[] = [];
    for (const person of this.world.allPeople()) {
      const schedule = scheduleForTime(person, this.world.timestampMinutes);
      if (!schedule) {
        continue;
      }
      if (schedule.id === person.runningScheduleId) {
        existingPeople.push(person);
        continue;
      }
      const change: any = {
        before: {
          runningScheduleId: person.runningScheduleId,
        },
        after: {
          runningScheduleId: schedule.id,
        },
      };
      allChanges[person.id] = change;
    }
    for (const person of existingPeople) {
      const schedule = scheduleForTime(person, this.world.timestampMinutes);
      if (!schedule) {
        throw new Error("No schedule");
      }
      if (schedule.inside.includes(person.inside)) {
        continue;
      }
      for (const dest of schedule.inside) {
        const path = pathTo(this.world, person.inside, dest);
        if (!path.length) {
          console.info(
            `Person ${person.id} can't go from ${person.inside}=>${dest}`
          );
          continue;
        }
        if (path.length === 1) {
          console.info(
            `Person ${person.id} goes directly from ${person.inside}=>${dest}${schedule.inside.length > 1 ? ` of ${schedule.inside}` : ""}`,
            schedule.inside
          );
        } else {
          console.log(
            `Person ${person.id} goes from ${person.inside}=>${path[0]} to get to ${dest}${schedule.inside.length > 1 ? ` of ${schedule.inside}` : ""}`,
            path
          );
        }
        const change: any = {
          before: {
            inside: person.inside,
          },
          after: {
            inside: path[0],
          },
        };
        allChanges[person.id] = { ...allChanges[person.id], ...change };
        break;
      }
    }
    if (Object.keys(allChanges).length > 0) {
      this.addStoryEvent({
        id: "narrator",
        totalTime: 0,
        roomId: "Intake",
        changes: allChanges,
        actions: [],
      });
    }
  }

  async addStoryEvent(storyEvent: StoryEventType) {
    this.updates.value = [...this.updates.value, storyEvent];
    const actions: ActionRequestType<any>[] = storyEvent.actionRequests || [];
    delete storyEvent.actionRequests;
    for (const entity of Object.values(this.world.entities)) {
      const newActions = entity.onStoryEvent(storyEvent);
      if (newActions) {
        actions.push(...(newActions || []));
      }
    }
    this.world.applyStoryEvent(storyEvent);
    await this.run(() => this.applyActions(actions));
  }

  removeStoryEvent(storyEvent: StoryEventType) {
    this.updates.value = this.updates.value.filter((e) => e !== storyEvent);
    // I could rebuild the world based on this... but right now I'm only using it for errors that have no world effect
  }

  async applyActions(actions: ActionRequestType<any>[]) {
    for (const action of actions) {
      if (isStoryEvent(action)) {
        await this.run(() => this.addStoryEvent(action));
      } else if (isPromptRequest(action)) {
        console.log(
          `Executing prompt request for ${action.id}:`,
          action.parameters
        );
        const entity = this.world.getEntity(action.id);
        if (!entity) {
          console.warn(
            `Prompt action for entity ${action.id} which does not exist`
          );
          continue;
        }
        await this.run(() =>
          entity.executePrompt(this, action.parameters || {})
        );
      } else {
        console.warn("Unknown action type", action);
      }
    }
  }

  _eventsWithPositions(): StoryEventWithPositionsType[] {
    let lastPositions = new Map<string, string>();
    let lastPositionsInRoom = new Map<string, string>();
    const notInRooms = new Set<string>();
    const result: StoryEventWithPositionsType[] = [];
    for (const entity of Object.values(this.world.original)) {
      if (!entity.inside) {
        continue;
      }
      lastPositions.set(entity.id, entity.inside);
      lastPositionsInRoom.set(entity.id, entity.inside);
      if (!this.world.rooms.includes(entity.inside)) {
        notInRooms.add(entity.id);
      }
    }
    for (const notInRoom of Array.from(notInRooms)) {
      let pos = lastPositions.get(notInRoom);
      while (pos && !this.world.rooms.includes(pos)) {
        pos = lastPositions.get(pos);
      }
      if (pos) {
        lastPositionsInRoom.set(notInRoom, pos);
      } else {
        console.warn("Entity not in room and no path to room", notInRoom);
      }
    }
    for (const update of this.updates.value) {
      const insideUpdates = new Map<string, string>();
      for (const [id, change] of Object.entries(update.changes)) {
        if (change.after.inside) {
          insideUpdates.set(id, change.after.inside);
        }
      }
      if (!insideUpdates.size) {
        result.push({ event: update, positions: lastPositionsInRoom });
        continue;
      }
      lastPositions = new Map(lastPositions);
      lastPositionsInRoom = new Map(lastPositionsInRoom);
      const notInRoom = new Set<string>();
      for (const [id, inside] of Array.from(insideUpdates)) {
        if (!this.world.rooms.includes(inside)) {
          notInRoom.add(id);
        }
        lastPositions.set(id, inside);
        lastPositionsInRoom.set(id, inside);
      }
      for (const notInRoomId of Array.from(notInRoom)) {
        let pos = lastPositions.get(notInRoomId);
        while (pos && !this.world.rooms.includes(pos)) {
          pos = lastPositions.get(pos);
        }
        if (pos) {
          lastPositionsInRoom.set(notInRoomId, pos);
        } else {
          console.warn("Entity not in room and no path to room", notInRoomId);
        }
      }
      result.push({ event: update, positions: lastPositionsInRoom });
    }
    return result;
  }

  checkLaunch() {
    if (!this.world.entities.player.launched) {
      const schedules = this.world.setupDailySchedules();
      const scheduleChanges = Object.fromEntries(
        Object.entries(schedules)
          .filter(([id, schedule]) => schedule.length > 0)
          .map(([id, schedule]) => {
            const change: any = { before: {}, after: {} };
            const person = this.world.getPerson(id)!;
            const nowSchedule = scheduleForTime(
              person,
              this.world.timestampMinutes,
              schedule
            );
            if (!person || !nowSchedule) {
              return [id, change];
            }
            let oldInside: string | undefined = person.inside;
            let inside = nowSchedule ? nowSchedule.inside[0] : undefined;
            if (inside === oldInside) {
              inside = undefined;
              oldInside = undefined;
            }
            if (inside || oldInside) {
              change.before.inside = oldInside;
              change.after.inside = inside;
            }
            change.before.todaysSchedule = [];
            change.after.todaysSchedule = schedule;
            change.before.runningScheduleId = person.runningScheduleId;
            change.after.runningScheduleId = nowSchedule.id;
            return [id, change];
          })
      );
      this.addStoryEvent({
        id: "narrator",
        totalTime: 0,
        roomId: "Intake",
        changes: {
          player: {
            before: {
              launched: false,
            },
            after: {
              launched: true,
            },
          },
          ...scheduleChanges,
        },
        actions: [],
      });
    }
  }

  async sendText(text: string) {
    const player = this.world.entities.player;
    await this.run(() => player.executePrompt(this, { input: text }));
    await this.scheduleTick();
  }

  undo(): string {
    const updates = [...this.updates.value];
    while (updates.length && !isUserInput(updates.at(-1)!)) {
      updates.pop();
    }
    let lastInput = "";
    if (updates.length && isUserInput(updates.at(-1)!)) {
      const update = updates.pop()!;
      lastInput = update.llmParameters?.input || lastInput;
    }
    this.updates.value = updates;
    this.world = new World({
      original: this.world.original,
      model: this,
    });
    this.checkLaunch();
    return lastInput;
  }

  async redo() {
    const redoText = this.undo();
    await this.sendText(redoText);
  }

  /* Load/save: */

  async proposeTitle(): Promise<string> {
    return `${this.world.entities.player.name} ${formatDate(new Date())}`;
  }

  async save(title: string) {
    save(title, this.updates.value);
  }

  async load(slug: string) {
    this.updates.value = [];
    const value = load(slug);
    this.updates.value = value;
    this.world = new World({
      original: this.world.original,
      model: this,
    });
    this.checkLaunch();
  }

  async listSaves(): Promise<SaveListType[]> {
    return listSaves().map((save) => {
      return {
        title: save.title,
        slug: save.slug,
        // Make it local time:
        date: formatDate(save.date),
      };
    });
  }

  async removeSave(slug: string) {
    return removeSave(slug);
  }
}

export type SaveListType = {
  title: string;
  slug: string;
  date: string;
};

function isUserInput(update: StoryEventType) {
  return update.id === "player";
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, "0");
  const formattedDate = `${year}-${month}-${day}`;
  return formattedDate;
}

export const model = new Model(entities);
