import { persistentSignal, SignalType } from "../persistentsignal";
import { TrackSettled } from "../tracksettled";
import { ActionRequestType, isPromptRequest, isStoryEvent } from "../types";
import { StoryEventType } from "../types";
import { World } from "./world";
import { AllEntitiesType, entities } from "./gameobjs";
import { listSaves, load, removeSave, save } from "../localsaves";

export class Model {
  updates: SignalType<StoryEventType[]>;
  world: World;
  promiseQueue: TrackSettled;

  constructor(startingEntities: AllEntitiesType) {
    if (typeof window !== "undefined") {
      (window as any).model = this;
    }
    this.promiseQueue = new TrackSettled();
    this.updates = persistentSignal<StoryEventType[]>("updates", []);
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

  checkLaunch() {
    if (!this.world.entities.player.launched) {
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
        },
        actions: [],
      });
    }
  }

  async sendText(text: string) {
    const player = this.world.entities.player;
    await this.run(() => player.executePrompt(this, { input: text }));
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
