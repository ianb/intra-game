import { computed, signal } from "@preact/signals-core";
import { persistentSignal, SignalType } from "../persistentsignal";
import { TrackSettled } from "../tracksettled";
import {
  ActionRequestType,
  isPromptRequest,
  isStoryDialog,
  isStoryEvent,
} from "../types";
import { StoryEventType } from "../types";
import type {
  ChangeType,
  ChangesType,
  EntityId,
  Person,
  StoryEventWithPositionsType,
} from "../types";
import { chat as defaultChat } from "../llm";
import { historyTurnsOf } from "../usage";
import type { ChatType } from "../types";
import { World } from "./world";
import type { AllEntitiesType } from "./content";
import { scheduleForTime } from "./scheduler";
import { pathTo } from "./pathto";
import { applyRewinds, lastTurnInput, lastTurnLength } from "./rewind";
import type { PartialTag } from "./tagstream";

export type ChatFn = (request: ChatType) => Promise<string>;

/**
 * A streaming LLM backend. Calls `onDelta` with text as it arrives and still
 * resolves to the complete response, so the authoritative parse is unchanged —
 * streaming only adds the ability to show a turn while it happens.
 */
export type ChatStreamFn = (
  request: ChatType,
  onDelta: (delta: string) => void,
) => Promise<string>;

/** A narrative tag currently arriving, for provisional display. */
export interface StreamingTagState {
  /** Whose response this is. */
  entityId: EntityId;
  tag: PartialTag;
}

export interface ModelOptions {
  // The LLM backend. Defaults to the real OpenRouter chat(); tests inject a fake.
  chat?: ChatFn;
  /**
   * Optional streaming backend. When present it is used instead of `chat`, and
   * narrative tags are surfaced on `streaming` as they arrive.
   */
  chatStream?: ChatStreamFn;
}

interface ParsedInputType {
  undo?: boolean;
  redo?: boolean;
  roll?: number;
  text?: string;
}

export class Model {
  updates: SignalType<StoryEventType[]>;
  world: World;
  promiseQueue: TrackSettled;
  updatesWithPositions: SignalType<StoryEventWithPositionsType[]>;
  /**
   * The events still in effect. `updates` is the full append-only log (and the
   * audit record); this is that log with undone turns filtered out. Everything
   * that reflects game state should read this, not `updates`.
   */
  liveUpdates: SignalType<StoryEventType[]>;
  nextRollOverride: number | null = null;
  chat: ChatFn;
  chatStream?: ChatStreamFn;
  /**
   * The narrative tag currently being received, or null between turns. This is
   * provisional display state only — the authoritative event still lands in
   * `updates` when the response completes.
   */
  streaming: SignalType<StreamingTagState | null>;

  constructor(startingEntities: AllEntitiesType, opts: ModelOptions = {}) {
    // Both backends go through stampMeta, so a prompt cannot reach a provider
    // without the context its usage record needs. Doing this at the six
    // assemble sites instead would mean the one that forgot produced records
    // that silently read as turn 0.
    const baseChat = opts.chat ?? defaultChat;
    this.chat = (request) => baseChat(this.stampMeta(request));
    const baseStream = opts.chatStream;
    this.chatStream = baseStream
      ? (request, onDelta) => baseStream(this.stampMeta(request), onDelta)
      : undefined;
    this.streaming = signal<StreamingTagState | null>(null);
    this.promiseQueue = new TrackSettled();
    // Versioned: this is the game itself, and the one stored thing where
    // misreading an old shape would be worse than not reading it.
    this.updates = persistentSignal<StoryEventType[]>("updates", [], {
      versioned: true,
    });
    this.liveUpdates = computed(() => applyRewinds(this.updates.value));
    this.updatesWithPositions = computed(() => this._eventsWithPositions());
    this.world = new World({
      original: startingEntities,
      model: this,
    });
  }

  get runningSignal() {
    return this.promiseQueue.runningSignal;
  }

  run<T>(func: () => Promise<T>): Promise<T> {
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
    const allChanges: ChangesType = {};
    // All the people with schedules, and no change in which schedule:
    const existingPeople: Person[] = [];
    for (const person of this.world.allPeople()) {
      const schedule = scheduleForTime(person, this.world.timestampMinutes);
      if (!schedule) {
        continue;
      }
      if (this.isDeferringSchedule(person)) {
        continue;
      }
      if (schedule.id === person.runningScheduleId) {
        existingPeople.push(person);
        continue;
      }
      const change: ChangeType = {
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
            `Person ${person.id} can't go from ${person.inside}=>${dest}`,
          );
          continue;
        }
        if (path.length === 1) {
          console.info(
            `Person ${person.id} goes directly from ${person.inside}=>${dest}${schedule.inside.length > 1 ? ` of ${schedule.inside}` : ""}`,
            schedule.inside,
          );
        } else {
          console.info(
            `Person ${person.id} goes from ${person.inside}=>${path[0]} to get to ${dest}${schedule.inside.length > 1 ? ` of ${schedule.inside}` : ""}`,
            path,
          );
        }
        const change: ChangeType = {
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
        roomId: "Void",
        changes: allChanges,
        actions: [],
      });
    }
  }

  isDeferringSchedule(person: Person) {
    let playerEvents = 0;
    let personEvents = 0;
    for (let i = this.liveUpdates.value.length - 1; i >= 0; i--) {
      const update = this.liveUpdates.value[i]!;
      if (update.id === "PLAYER") {
        playerEvents++;
      } else if (update.id === person.id) {
        personEvents++;
      }
      if (update.id === person.id && update.deferSchedule) {
        return true;
      }
      if (update.id === person.id && update.deferSchedule === false) {
        return false;
      }
      if (playerEvents > 2 || personEvents > 2) {
        break;
      }
    }
    return false;
  }

  async addStoryEvent(storyEvent: StoryEventType) {
    this.updates.value = [...this.updates.value, storyEvent];
    const actions: ActionRequestType[] = storyEvent.actionRequests || [];
    delete storyEvent.actionRequests;
    const recent = this.recentReferencedEntities();
    for (const entityId of recent) {
      const entity = this.world.getEntity(entityId);
      if (!entity) {
        console.warn(`Entity ${entityId} not found`);
        continue;
      }
      const newActions = entity.onStoryEvent(storyEvent);
      if (newActions) {
        actions.push(...(newActions || []));
      }
    }
    for (const entity of Object.values(this.world.entities)) {
      if (recent.includes(entity.id)) {
        continue;
      }
      const newActions = entity.onStoryEvent(storyEvent);
      if (newActions) {
        actions.push(...(newActions || []));
      }
    }
    this.world.applyStoryEvent(storyEvent);
    await this.run(() => this.applyActions(actions));
  }

  recentReferencedEntities(): EntityId[] {
    let result: EntityId[] = [];
    for (let i = this.liveUpdates.value.length - 1; i >= 0; i--) {
      const update = this.liveUpdates.value[i]!;
      for (let j = update.actions.length - 1; j >= 0; j--) {
        const action = update.actions[j]!;
        if (isStoryDialog(action) && action.toId) {
          if (!result.includes(action.toId)) {
            result.push(action.toId);
          }
        }
      }
      if (result.length >= 5) {
        break;
      }
    }
    const lastUpdate = this.liveUpdates.value.at(-1);
    if (lastUpdate && lastUpdate.triggers) {
      for (const id of Object.keys(lastUpdate.triggers)) {
        result = [id, ...result.filter((e) => e !== id)];
      }
    }
    return result;
  }

  removeStoryEvent(storyEvent: StoryEventType) {
    this.updates.value = this.updates.value.filter((e) => e !== storyEvent);
    // I could rebuild the world based on this... but right now I'm only using it for errors that have no world effect
  }

  async applyActions(actions: ActionRequestType[]) {
    for (const action of actions) {
      if (isStoryEvent(action)) {
        await this.run(() => this.addStoryEvent(action));
      } else if (isPromptRequest(action)) {
        console.info(
          `Executing prompt request for ${action.id}:`,
          action.parameters,
        );
        const entity = this.world.getEntity(action.id);
        if (!entity) {
          console.warn(
            `Prompt action for entity ${action.id} which does not exist`,
          );
          continue;
        }
        await this.run(() =>
          entity.executePrompt(this, action.parameters || {}),
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
    for (const update of this.liveUpdates.value) {
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
        lastPositions.set(id, inside);
        lastPositionsInRoom.set(id, inside);
      }
      for (const [id, inside] of Array.from(lastPositions)) {
        if (!this.world.rooms.includes(inside)) {
          notInRoom.add(id);
        }
      }
      for (const notInRoomId of Array.from(notInRoom)) {
        let pos = lastPositions.get(notInRoomId);
        while (pos && !this.world.rooms.includes(pos)) {
          pos = lastPositions.get(pos);
        }
        if (pos && lastPositionsInRoom.get(notInRoomId) !== pos) {
          lastPositionsInRoom.set(notInRoomId, pos);
        } else if (!pos) {
          console.warn("Entity not in room and no path to room", notInRoomId);
        }
      }
      result.push({ event: update, positions: lastPositionsInRoom });
    }
    return result;
  }

  /**
   * Record where in the game a prompt was assembled, for its usage record.
   *
   * `??=` rather than `=`: a caller that knows better — a replay, a harness —
   * keeps what it set.
   */
  private stampMeta(request: ChatType): ChatType {
    request.meta.turn ??= this.updates.value.length;
    request.meta.historyTurns ??= historyTurnsOf(request.messages);
    return request;
  }

  checkLaunch() {
    if (!this.world.entities.PLAYER.launched) {
      const schedules = this.world.setupDailySchedules();
      const scheduleChanges = Object.fromEntries(
        Object.entries(schedules)
          .filter(([id, schedule]) => schedule.length > 0)
          .map(([id, schedule]) => {
            const change: ChangeType = { before: {}, after: {} };
            const person = this.world.getPerson(id)!;
            const nowSchedule = scheduleForTime(
              person,
              this.world.timestampMinutes,
              schedule,
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
          }),
      );
      this.addStoryEvent({
        id: "narrator",
        totalTime: 0,
        roomId: "Intake",
        changes: {
          PLAYER: {
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

  async sendText(text: string): Promise<string | undefined> {
    const parsed = this.parseText(text);
    if (parsed.undo) {
      return this.undo();
    }
    if (parsed.redo) {
      await this.redo();
      return;
    }
    if (parsed.roll) {
      this.nextRollOverride = parsed.roll;
    }
    if (parsed.text) {
      const player = this.world.entities.PLAYER;
      await this.run(() => player.executePrompt(this, { input: parsed.text }));
      await this.run(() => this.scheduleTick());
    }
    return undefined;
  }

  parseText(text: string): ParsedInputType {
    const resp: ParsedInputType = {};
    if (text.includes("/undo")) {
      resp.undo = true;
      text = text.replace("/undo", "").trim();
    }
    if (text.includes("/redo")) {
      resp.redo = true;
      text = text.replace("/redo", "").trim();
    }
    const rollRegex = /\/roll (\d+)$/;
    if (rollRegex.test(text)) {
      const match = text.match(rollRegex);
      resp.roll = parseInt(match![1]!, 10);
      text = text.replace(rollRegex, "").trim();
    }
    resp.text = text;
    return resp;
  }

  /**
   * Undo the last player turn.
   *
   * Appends a rewind marker rather than deleting anything, so the log stays
   * append-only and the undone turn remains visible to an auditor. Returns the
   * input that was undone, so redo can replay it.
   */
  undo(): string {
    const live = this.liveUpdates.value;
    const count = lastTurnLength(live);
    if (!count) {
      return "";
    }
    const lastInput = lastTurnInput(live);
    this.updates.value = [
      ...this.updates.value,
      {
        id: "narrator",
        totalTime: 0,
        roomId: "Void",
        changes: {},
        actions: [],
        rewind: count,
      },
    ];
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

  /**
   * Adopt a log produced elsewhere (the server's session), replacing this one.
   *
   * Unlike replaceLog this does NOT checkLaunch: the server owns starting the
   * session, and launching locally would both duplicate those events and fire
   * local LLM calls for work that isn't this client's to do.
   */
  adoptRemoteLog(events: StoryEventType[]) {
    this.updates.value = events;
    this.world = new World({
      original: this.world.original,
      model: this,
    });
  }

  /**
   * Append events produced elsewhere — the server — without running the engine.
   *
   * Deliberately not addStoryEvent: that is the *generating* path, which fires
   * onStoryEvent and would kick off a second round of local LLM calls for work
   * the server already did. This only folds the events into the world.
   */
  appendRemoteEvents(events: StoryEventType[]) {
    if (!events.length) {
      return;
    }
    this.updates.value = [...this.updates.value, ...events];
    for (const event of events) {
      this.world.applyStoryEvent(event);
    }
  }

  /**
   * Replace the whole log (loading a saved game). Client-side saves live in
   * app/saves.ts; the engine only needs to be told the log changed.
   */
  replaceLog(events: StoryEventType[]) {
    this.updates.value = events;
    this.world = new World({
      original: this.world.original,
      model: this,
    });
    this.checkLaunch();
  }

  roll(sides = 20) {
    if (this.nextRollOverride !== null) {
      const result = this.nextRollOverride;
      this.nextRollOverride = null;
      return result;
    }
    return Math.floor(Math.random() * sides) + 1;
  }
}
