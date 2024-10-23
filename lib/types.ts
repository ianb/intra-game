import type { Entity, Room, Person } from "./game/classes";
export { Entity, Room, Person };

export type StoryEventWithPositionsType = {
  event: StoryEventType;
  positions: Map<EntityId, EntityId>;
};

export type StoryEventType = {
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
  llmParameters?: any;
  llmError?: { context: string; description: string };
  suggestions?: string;
};
export type StoryActionType =
  | StoryDialogType
  | StoryDescriptionType
  | StoryActionAttemptType;

export type StoryDialogType = {
  type: "dialog";
  id: EntityId;
  toId?: EntityId;
  toOther?: string;
  text: string;
};

export function isStoryDialog(
  storyAction: StoryActionType
): storyAction is StoryDialogType {
  return storyAction.type === "dialog";
}

export type StoryDescriptionType = {
  type: "description";
  text: string;
  minutes?: number;
  subject?: string;
};

export function isStoryDescription(
  storyAction: StoryActionType
): storyAction is StoryDescriptionType {
  return storyAction.type === "description";
}

export type StoryActionAttemptType = {
  type: "actionAttempt";
  id: EntityId;
  attempt: string;
  success: boolean;
  minutes: number;
  resolution: string;
};

export function isStoryActionAttempt(
  actionRequest: StoryActionType
): actionRequest is StoryActionAttemptType {
  return actionRequest.type === "actionAttempt";
}

export type ChangesType = Record<EntityId, ChangeType>;

export type ChangeType = {
  before: Record<string, any>;
  after: Record<string, any>;
};

export type ActionRequestType<T = object> =
  | StoryEventType
  | PromptRequestType<T>;

export type PromptRequestType<T = object> = {
  type: "promptRequest";
  id: EntityId;
  parameters: T;
};

export function isStoryEvent(
  actionRequest: ActionRequestType
): actionRequest is StoryEventType {
  return (actionRequest as StoryEventType).changes !== undefined;
}

export function isPromptRequest(
  actionRequest: ActionRequestType
): actionRequest is PromptRequestType {
  return (actionRequest as PromptRequestType).type === "promptRequest";
}

export type PromptStateType = Record<string, PromptStateDescriptorType>;

export type PromptStateDescriptorType = {
  value: any;
  write?: boolean;
  description?: string;
  writeInstructions?: string;
};

// I wish this was keyof AllEntitiesType but can't quite make it work:
export type EntityId = string;

/* Some class testers... */

export function isRoom(entity: Entity<any>): entity is Room {
  return entity.type === "room" || entity.type.startsWith("room/");
}

export function isPerson(entity: Entity): entity is Person {
  return entity.type === "person" || entity.type.startsWith("person/");
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

export type GeneralScheduleType = {
  id: ScheduleId;
  time: TimeType;
  activity: string;
  description: string;
  // How long will this last (roughly) in minutes?
  minuteLength: number;
};

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

export type PersonScheduledEventType = {
  scheduleId: ScheduleId;
  time: TimeType;
  inside: EntityId[];
  minuteLength: number;
};

/* Gemini types */

export type GeminiChatType = {
  meta: GeminiMetaType;
  model?: GeminiModelType;
  history: GeminiHistoryType[];
  message: string;
  systemInstruction?: string;
};

export type GeminiMetaType = {
  title: string;
  index?: number;
  start?: number;
};

export type GeminiModelType =
  | "gemini-1.5-flash"
  | "gemini-1.5-flash-exp-0827"
  | "gemini-1.5-pro"
  | "gemini-1.5-pro-exp-0827"
  | "flash"
  | "pro";

export type GeminiRoleType = "user" | "model";

export type GeminiHistoryType = {
  role: GeminiRoleType;
  parts?: GeminiHistoryPartType[];
  text?: string;
};

export type GeminiHistoryPartType = {
  text: string;
};

export type LlmLogType = {
  request: GeminiChatType;
  end?: number;
  response?: string;
  errorMessage?: string;
  errorBody?: any;
};
