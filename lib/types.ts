export type PhaseType = "intro" | "characterCreation" | "gameplay";

export type SessionType = {
  name: string;
  profession: string;
  phase: PhaseType;
};

export type GeminiModelType = "gemini-1.5-flash" | "gemini-1.5-pro";

export type GeminiChatType = {
  model: GeminiModelType;
  history: GeminiHistoryType[];
  message: string;
};

export type GeminiRoleType = "user" | "model";

export type GeminiHistoryType = {
  role: GeminiRoleType;
  parts: GeminiHistoryPartType[];
};

export type GeminiHistoryPartType = {
  text: string;
};
