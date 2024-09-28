export type PhaseType = "intro" | "characterCreation" | "gameplay";

export type SessionType = {
  name: string;
  profession: string;
  phase: PhaseType;
};

export type GeminiChatType = {
  meta: GeminiMetaType;
  model: GeminiModelType;
  history: GeminiHistoryType[];
  message: string;
};

export type GeminiMetaType = {
  title: string;
  index?: number;
  start?: number;
};

export type GeminiModelType = "gemini-1.5-flash" | "gemini-1.5-pro";

export type GeminiRoleType = "user" | "model";

export type GeminiHistoryType = {
  role: GeminiRoleType;
  parts: GeminiHistoryPartType[];
};

export type GeminiHistoryPartType = {
  text: string;
};

export type LlmLogType = {
  request: GeminiChatType;
  end?: number;
  response?: string;
};
