/* Chat game types */
import type { Model } from "./model";
import type { TagType } from "./parsetags";

export type UpdateStreamType =
  | StateUpdateType
  | EntityInteractionType
  | LlmErrorType;

export type StateUpdateType = {
  type: "stateUpdate";
  id: string;
  updates: Record<string, any>;
};

export function isStateUpdate(
  update: UpdateStreamType
): update is StateUpdateType {
  return update.type === "stateUpdate";
}

export type EntityInteractionType = {
  type: "entityInteraction";
  entityId: string;
  inputVariables?: Record<string, any>;
  response: string;
  tags: TagType[];
};

export function isEntityInteraction(
  update: UpdateStreamType
): update is EntityInteractionType {
  return update.type === "entityInteraction";
}

export type LlmErrorType = {
  type: "llmError";
  context: string;
  description: string;
};

export function isLlmError(update: UpdateStreamType): update is LlmErrorType {
  return update.type === "llmError";
}

export type RoomOrEntity = RoomType | EntityType;

export type RoomType = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  color: string;
  exits: ExitType[];
  onEvent?: (this: RoomType, _event: string, _model: Model) => Promise<void>;
  onGlobalEvent?: (
    this: RoomType,
    _event: string,
    _model: Model
  ) => Promise<void>;
  state: Record<string, any>;
  prompts: Record<string, string>;
};

export function isRoom(roomOrEntity: RoomOrEntity): roomOrEntity is RoomType {
  return roomOrEntity.id.startsWith("room:");
}

export function isEntity(
  roomOrEntity: RoomOrEntity
): roomOrEntity is EntityType {
  return roomOrEntity.id.startsWith("entity:");
}

export type RoomDefinitionType = Omit<RoomType, "state" | "prompts" | "color"> &
  Partial<Pick<RoomType, "state" | "prompts" | "color">>;

export type ExitType = {
  roomId: string;
  name?: string;
  restriction?: string;
};

export type EntityType = {
  id: string;
  name: string;
  pronouns: string;
  shortDescription: string;
  description: string;
  roleplayInstructions: string;
  color: string;
  locationId: string;
  commands?: string;
  prompts: Record<string, string>;
  onEvent?: (this: EntityType, _event: string, _model: Model) => Promise<void>;
  onGlobalEvent?: (
    this: EntityType,
    _event: string,
    _model: Model
  ) => Promise<void>;
  choosePrompt?: (
    this: EntityType,
    _model: Model,
    props: Record<string, any>
  ) => PromptChoiceType;
  onCommand?: (
    this: EntityType,
    _command: TagType,
    model: Model
  ) => void | Promise<void>;
  state: Record<string, any>;
  inventory: Record<string, string>;
  blipAis: Record<string, string>;
  roomAccess: Record<string, string>;
  cannotSpeak?: boolean;
  cannotDescribe?: boolean;
  cannotThink?: boolean;
};

export type PromptChoiceType = {
  id: string;
  props?: Record<string, any>;
};

export type EntityDefinitionType = Omit<
  EntityType,
  "state" | "pronouns" | "color" | "inventory" | "blipAis" | "roomAccess"
> &
  Partial<
    Pick<
      EntityType,
      "state" | "pronouns" | "color" | "inventory" | "blipAis" | "roomAccess"
    >
  >;

export type CommandType = {
  id: string;
  example: string;
};

/* Session types */

export type PhaseType = "intro" | "characterCreation" | "gameplay";

export type SessionType = {
  updates: UpdateStreamType[];
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
