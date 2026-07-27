import type { ModelTier } from "./models";
import type { Entity, Mystery, Person, Room } from "./game/classes";
export { Entity, Person, Room };

export interface StoryEventWithPositionsType {
  event: StoryEventType;
  positions: Map<EntityId, EntityId>;
}

export interface StoryEventType {
  id: EntityId;
  roomId: EntityId;
  changes: ChangesType;
  actions: StoryActionType[];
  // In minutes:
  totalTime: number;
  actionRequests?: ActionRequestType[];
  deferSchedule?: boolean;
  llmTitle?: string;
  llmResponse?: string;
  llmParameters?: Record<string, unknown>;
  llmError?: { context: string; description: string };
  suggestions?: string;
  todos?: TodoUpdateType[];
  triggers?: Record<EntityId, string>;
  // Set on an undo marker: supersedes this many preceding live events. The
  // log stays append-only; see lib/game/rewind.ts.
  rewind?: number;
}
export type StoryActionType =
  StoryDialogType | StoryDescriptionType | StoryActionAttemptType;

/** One edit to the player's task list; see lib/game/todos.ts. */
export interface TodoUpdateType {
  /** Derived from the title, not minted by the model. */
  id: string;
  title: string;
  done: boolean;
  /** The entity this came from, when the engine derived it — e.g. a mystery. */
  from?: EntityId;
}

/** A task on the player's list, as folded out of the log. */
export type TodoType = TodoUpdateType & {
  /** Who put it there — usually Ama, but any character may. */
  by: EntityId;
};

export interface StoryDialogType {
  type: "dialog";
  id: EntityId;
  toId?: EntityId;
  toOther?: string;
  text: string;
}

export function isStoryDialog(
  storyAction: StoryActionType,
): storyAction is StoryDialogType {
  return storyAction.type === "dialog";
}

export interface StoryDescriptionType {
  type: "description";
  text: string;
  minutes?: number;
  subject?: string;
}

export function isStoryDescription(
  storyAction: StoryActionType,
): storyAction is StoryDescriptionType {
  return storyAction.type === "description";
}

export interface StoryActionAttemptType {
  type: "actionAttempt";
  id: EntityId;
  attempt: string;
  success: boolean;
  minutes: number;
  resolution: string;
}

export function isStoryActionAttempt(
  actionRequest: StoryActionType,
): actionRequest is StoryActionAttemptType {
  return actionRequest.type === "actionAttempt";
}

export type ChangesType = Record<EntityId, ChangeType>;

/**
 * A before/after pair for one entity, as recorded in the event log.
 *
 * The payloads stay `any` rather than `unknown` on purpose. Their shape is
 * whatever fields that entity changed, and the engine reads them positionally
 * all over (`changes.after.inside`, `.launched`, `.personality`); `unknown`
 * would buy no safety and cost a cast at every read. The two lines below are
 * the only `any` left in the codebase — see eslint.config.mjs.
 */
export interface ChangeType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  after: Record<string, any>;
}

export type ActionRequestType<T = object> =
  StoryEventType | PromptRequestType<T>;

export interface PromptRequestType<T = object> {
  type: "promptRequest";
  id: EntityId;
  parameters: T;
}

export function isStoryEvent(
  actionRequest: ActionRequestType,
): actionRequest is StoryEventType {
  return (actionRequest as StoryEventType).changes !== undefined;
}

export function isPromptRequest(
  actionRequest: ActionRequestType,
): actionRequest is PromptRequestType {
  return (actionRequest as PromptRequestType).type === "promptRequest";
}

// I wish this was keyof AllEntitiesType but can't quite make it work:
export type EntityId = string;

/* Some class testers... */

export function isRoom(entity: Entity): entity is Room {
  return entity.type === "room" || entity.type.startsWith("room/");
}

export function isPerson(entity: Entity): entity is Person {
  return entity.type === "person" || entity.type.startsWith("person/");
}

export function isMystery(entity: Entity): entity is Mystery {
  return entity.type === "mystery" || entity.type.startsWith("mystery/");
}

/* Schedule types */

/*
Note: each character has a schedule. It should roughly adhere to the Intra schedule (especially wake-up, meals, and lights-out). Each person wakes has a room assigned to them, Quarters_John/etc, that they sleep in.

Events may overlap, in which case the person may choose different activities on different days.

Each person should have one or more secret activities. These are activities that they don't want other people to know about, which might be embarassing or secret for another reason. These activities can overlap with other activities, and don't need to be long. (E.g., a 10 minute secret activity is fine). Make the secret activities interesting, silly, and fun.

All activities should express the absurdity of the environment and the strong personality of each character.
*/

// This is minutes since midnight of the first day of the game
export type TimeType = number;

export type ScheduleId = string;

export interface GeneralScheduleType {
  id: ScheduleId;
  time: TimeType;
  activity: string;
  description: string;
  // How long will this last (roughly) in minutes?
  minuteLength: number;
}

export type PersonScheduleType = GeneralScheduleType & {
  // A single location, or a list of locations if the person can be in one of several locations during this time
  inside: EntityId[];
  // If attentive is true, then the person is potentially engaged with the player character or other people; if false then the person is probably unlikely to proactively engage socially
  attentive: boolean;
  // If secret is true, this is the reason the person wants to keep it secret
  secret?: boolean;
  // If this is a secret activity that the person might want to hide from other people
  secretReason?: string;
};

export type PersonScheduleTemplateType = PersonScheduleType & {
  // How many minutes early or late might the person start this activity? E.g., early: 5, late: 10 means the person might start it up to 5 minutes early or 10 minutes late
  early: number;
  late: number;
};

export interface PersonScheduledEventType {
  scheduleId: ScheduleId;
  time: TimeType;
  inside: EntityId[];
  minuteLength: number;
}

/* LLM types */

export interface ChatType {
  meta: ChatMetaType;
  /** Which tier this prompt needs; see lib/models.ts. Unset means "pro". */
  model?: ModelTier;
  messages: MessageType[];
}

export interface ChatMetaType {
  title: string;
  index?: number;
  start?: number;
  /** The entity this prompt was assembled for; stamped in classes.ts. */
  entity?: EntityId;
  /** Log length when it was assembled — how far into the game this happened. */
  turn?: number;
  /** History messages carried, beyond the system prompt. */
  historyTurns?: number;
}

export type RoleType = "user" | "assistant" | "system";

export interface MessageType {
  role: RoleType;
  content: string;
}

export interface LlmLogType {
  request: ChatType;
  end?: number;
  response?: string;
  errorMessage?: string;
  errorBody?: unknown;
}
