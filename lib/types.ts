/* Chat game types */
import type { Model } from "./model";
import type { TagType } from "./parsetags";

export type UpdateStreamType = StateUpdateType | EntityInteractionType;

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

export type InteractionType = {
  activeEntityIds: string[];
  passiveEntityIds: string[];
  roomId: string;
  inventory: Record<string, string>;
  availableAiIds: string[];
  accessControl: Record<string, string>;
};

export type RoomType = {
  id: string;
  name: string;
  description: string;
  color: string;
  exits: ExitType[];
  onEvent?: (_event: string, _model: Model) => Promise<void>;
  onGlobalEvent?: (_event: string, _model: Model) => Promise<void>;
  state: Record<string, any>;
  prompts?: Record<string, string>;
};

export type ExitType = {
  roomId: string;
  name?: string;
  restriction: string;
};

export type EntityType = {
  id: string;
  name: string;
  description: string;
  color: string;
  commands?: string;
  onEvent?: (_event: string, _model: Model) => Promise<void>;
  onGlobalEvent?: (_event: string, _model: Model) => Promise<void>;
  onCommand?: (_command: TagType, model: Model) => void;
  state: Record<string, any>;
  prompts?: Record<string, string>;
};

export type CommandType = {
  id: string;
  example: string;
};

/* Session types */

export type PhaseType = "intro" | "characterCreation" | "gameplay";

export type SessionType = {
  interaction: InteractionType;
  updates: UpdateStreamType[];
};

/* Gemini types */

export type GeminiChatType = {
  meta: GeminiMetaType;
  model?: GeminiModelType;
  history: GeminiHistoryType[];
  message: string;
};

export type GeminiMetaType = {
  title: string;
  index?: number;
  start?: number;
};

export type GeminiModelType = "gemini-1.5-flash" | "gemini-1.5-pro" | "flash";

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
};