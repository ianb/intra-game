/**
 * Gemini Live API shapes for the voice experiment: models, voices, the
 * ephemeral-token request the Worker makes, the WebSocket setup message the
 * browser sends, and the usage figures read back.
 *
 * Gemini Live is a WebSocket carrying raw PCM (16 kHz in, 24 kHz out), so the
 * browser side (app/geminivoice.ts) does its own capture and playback. This
 * file has no DOM types; the Worker typechecks it too.
 */

import {
  DEFAULT_TURN_TAKING,
  EMPTY_USAGE,
  type ResponseUsage,
  type TurnTaking,
} from "./realtime";

/**
 * Ephemeral tokens are documented for v1beta today; the JS SDK still warns
 * that its own support is v1alpha-only. One constant so a flip is one edit.
 */
export const GEMINI_API_VERSION = "v1beta";
export const GEMINI_HOST = "generativelanguage.googleapis.com";

export const GEMINI_MODELS = [
  "gemini-3.8-live",
  "gemini-3.8-live-extended-thinking",
] as const;
export type GeminiModel = (typeof GEMINI_MODELS)[number];
export const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-3.8-live";

/** The prebuilt voices, in the order Google lists them. */
export const GEMINI_VOICES = [
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
] as const;
export type GeminiVoice = (typeof GEMINI_VOICES)[number];

export const GEMINI_INPUT_RATE = 16000;
export const GEMINI_OUTPUT_RATE = 24000;

/** Audio-only sessions end at 15 minutes unless context compression is on; it is on here. */
export const GEMINI_SESSION_LIMIT_MINUTES = 15;

export function isGeminiModel(value: unknown): value is GeminiModel {
  return (GEMINI_MODELS as readonly unknown[]).includes(value);
}

export function isGeminiVoice(value: unknown): value is GeminiVoice {
  return (GEMINI_VOICES as readonly unknown[]).includes(value);
}

export interface GeminiSessionSpec {
  provider: "gemini";
  model: GeminiModel;
  voice: GeminiVoice;
  instructions: string;
  transcribeInput?: boolean;
  turnTaking?: TurnTaking;
  /** Let the model decide not to answer at all. */
  proactiveAudio?: boolean;
  /** Let the model adapt its delivery to the player's tone. */
  affectiveDialog?: boolean;
}

// --- The Worker's side: minting a token ---------------------------------------

export function geminiTokenUrl(): string {
  return `https://${GEMINI_HOST}/${GEMINI_API_VERSION}/auth_tokens`;
}

/** How long the token accepts messages, and how long it accepts a new session. */
export const GEMINI_TOKEN_TTL_MINUTES = 30;
export const GEMINI_NEW_SESSION_TTL_MINUTES = 2;

/**
 * The body for POST auth_tokens. One use, short windows, and no
 * liveConnectConstraints: the browser sends the full setup itself, on the
 * player's own account, so there is nothing to lock server-side.
 */
export function geminiTokenRequest(now: number): Record<string, unknown> {
  return {
    uses: 1,
    expireTime: new Date(now + GEMINI_TOKEN_TTL_MINUTES * 60_000).toISOString(),
    newSessionExpireTime: new Date(
      now + GEMINI_NEW_SESSION_TTL_MINUTES * 60_000,
    ).toISOString(),
  };
}

// --- The browser's side: the socket and its messages ---------------------------

/**
 * Where an ephemeral token connects. Tokens use the Constrained method and go
 * in the access_token query parameter (a browser WebSocket cannot set an
 * Authorization header); a standard key would use BidiGenerateContent?key=.
 */
export function geminiSocketUrl(token: string): string {
  return (
    `wss://${GEMINI_HOST}/ws/google.ai.generativelanguage.${GEMINI_API_VERSION}` +
    `.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`
  );
}

/** The automaticActivityDetection block for a turn-taking mode. */
export function geminiActivityDetection(
  mode: TurnTaking,
): Record<string, unknown> {
  switch (mode) {
    case "patient":
      return {
        endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
        silenceDurationMs: 800,
      };
    case "unhurried":
      return {
        endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
        silenceDurationMs: 1500,
        prefixPaddingMs: 300,
      };
    default:
      return {};
  }
}

/** The first message on the socket. */
export function geminiSetupMessage(
  spec: GeminiSessionSpec,
): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    responseModalities: ["AUDIO"],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: spec.voice } },
    },
  };
  if (spec.affectiveDialog) {
    generationConfig.enableAffectiveDialog = true;
  }
  const setup: Record<string, unknown> = {
    model: `models/${spec.model}`,
    generationConfig,
    systemInstruction: { parts: [{ text: spec.instructions }] },
    realtimeInputConfig: {
      automaticActivityDetection: geminiActivityDetection(
        spec.turnTaking ?? DEFAULT_TURN_TAKING,
      ),
    },
    outputAudioTranscription: {},
    // Without this an audio session ends at 15 minutes.
    contextWindowCompression: { slidingWindow: {} },
  };
  if (spec.transcribeInput) {
    setup.inputAudioTranscription = {};
  }
  if (spec.proactiveAudio) {
    setup.proactivity = { proactiveAudio: true };
  }
  return { setup };
}

/** One chunk of microphone audio: 16-bit little-endian PCM at 16 kHz, base64. */
export function geminiAudioMessage(base64: string): Record<string, unknown> {
  return {
    realtimeInput: {
      audio: { data: base64, mimeType: `audio/pcm;rate=${GEMINI_INPUT_RATE}` },
    },
  };
}

/** A text turn from the client, used for the opening line. */
export function geminiTextTurn(text: string): Record<string, unknown> {
  return {
    clientContent: {
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: true,
    },
  };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function byModality(details: unknown, modality: string): number {
  if (!Array.isArray(details)) {
    return 0;
  }
  return details
    .map((entry) => obj(entry))
    .filter((entry) => entry.modality === modality)
    .reduce((sum, entry) => sum + num(entry.tokenCount), 0);
}

/**
 * Usage from a server message, or null when it carries none. The reference
 * says usageMetadata is per message rather than cumulative, so these add up.
 */
export function usageFromGeminiMessage(message: unknown): ResponseUsage | null {
  const usage = obj(obj(message).usageMetadata);
  if (!Object.keys(usage).length) {
    return null;
  }
  return {
    ...EMPTY_USAGE,
    inputTokens: num(usage.promptTokenCount),
    outputTokens: num(usage.responseTokenCount),
    cachedTokens: num(usage.cachedContentTokenCount),
    inputText: byModality(usage.promptTokensDetails, "TEXT"),
    inputAudio: byModality(usage.promptTokensDetails, "AUDIO"),
    outputText: byModality(usage.responseTokensDetails, "TEXT"),
    outputAudio: byModality(usage.responseTokensDetails, "AUDIO"),
  };
}

/** What the browser needs out of a server message, flattened. */
export interface GeminiServerEvent {
  setupComplete: boolean;
  /** Base64 PCM chunks in this message, in order. */
  audio: string[];
  turnComplete: boolean;
  interrupted: boolean;
  outputTranscript: string | null;
  inputTranscript: string | null;
  usage: ResponseUsage | null;
  /** Seconds until the server closes, when it has warned. */
  goAwaySeconds: number | null;
}

export function readGeminiMessage(message: unknown): GeminiServerEvent {
  const m = obj(message);
  const content = obj(m.serverContent);
  const parts = Array.isArray(obj(content.modelTurn).parts)
    ? (obj(content.modelTurn).parts as unknown[])
    : [];
  const audio = parts
    .map((part) => obj(obj(part).inlineData))
    .filter(
      (data) =>
        typeof data.data === "string" &&
        typeof data.mimeType === "string" &&
        data.mimeType.startsWith("audio/pcm"),
    )
    .map((data) => data.data as string);
  const outputTranscript = obj(content.outputTranscription).text;
  const inputTranscript = obj(content.inputTranscription).text;
  const timeLeft = obj(m.goAway).timeLeft;
  return {
    setupComplete: "setupComplete" in m,
    audio,
    turnComplete: content.turnComplete === true,
    interrupted: content.interrupted === true,
    outputTranscript:
      typeof outputTranscript === "string" ? outputTranscript : null,
    inputTranscript:
      typeof inputTranscript === "string" ? inputTranscript : null,
    usage: usageFromGeminiMessage(m),
    goAwaySeconds:
      typeof timeLeft === "string"
        ? Number.parseFloat(timeLeft) || 0
        : "goAway" in m
          ? 0
          : null,
  };
}
