import type { Entity, Room, Person } from "./game/classes";
export { Entity, Room, Person };

export type StoryEventType = {
  id: EntityId;
  roomId: EntityId;
  changes: ChangesType;
  actions: StoryActionType[];
  actionRequests?: ActionRequestType[];
  llmTitle?: string;
  llmResponse?: string;
  llmParameters?: any;
  llmError?: { context: string; description: string };
  suggestions?: string;
};
export type StoryActionType = StoryDialogType | StoryDescriptionType;

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
};

export function isStoryDescription(
  storyAction: StoryActionType
): storyAction is StoryDescriptionType {
  return storyAction.type === "description";
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
