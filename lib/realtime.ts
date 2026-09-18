/**
 * Shared pieces of the voice-conversation experiment: which Realtime models
 * and voices the UI offers, the request the Worker sends OpenAI for a client
 * secret, and the usage figures read back from each spoken response.
 *
 * No DOM types in this file. The Worker typechecks lib/ too, and the browser
 * side of the feature lives in app/voice.ts.
 */

export const REALTIME_MODELS = [
  "gpt-realtime-2.1-mini",
  "gpt-realtime-2.1",
] as const;
export type RealtimeModel = (typeof REALTIME_MODELS)[number];
export const DEFAULT_REALTIME_MODEL: RealtimeModel = "gpt-realtime-2.1-mini";

export const REALTIME_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;
export type RealtimeVoice = (typeof REALTIME_VOICES)[number];

/** Input transcription is billed on top of the session, so it is opt-in. */
export const INPUT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

/** How long a minted client secret stays usable; the browser connects within seconds. */
export const CLIENT_SECRET_TTL_SECONDS = 600;

/** Realtime sessions end after this long whatever the client does. */
export const SESSION_LIMIT_MINUTES = 60;

export function isRealtimeModel(value: unknown): value is RealtimeModel {
  return (REALTIME_MODELS as readonly unknown[]).includes(value);
}

export function isRealtimeVoice(value: unknown): value is RealtimeVoice {
  return (REALTIME_VOICES as readonly unknown[]).includes(value);
}

/** Everything a session needs besides the credential. */
export interface RealtimeSessionSpec {
  model: RealtimeModel;
  voice: RealtimeVoice;
  instructions: string;
  transcribeInput?: boolean;
}

/** What the browser posts to /api/realtime/secret. */
export interface ClientSecretRequestBody extends RealtimeSessionSpec {
  apiKey: string;
}

/** What /api/realtime/secret answers. Never the player's key. */
export interface ClientSecretResponse {
  secret: string;
  /** Unix seconds, as OpenAI reports it; 0 when it did not. */
  expiresAt: number;
  model: RealtimeModel;
  voice: RealtimeVoice;
}

/**
 * The body for POST https://api.openai.com/v1/realtime/client_secrets.
 *
 * The session configuration rides inside the secret, so the browser never has
 * to send instructions over the data channel before the character can speak.
 */
export function clientSecretRequest(
  spec: RealtimeSessionSpec,
): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if (spec.transcribeInput) {
    input.transcription = { model: INPUT_TRANSCRIPTION_MODEL };
  }
  return {
    expires_after: { anchor: "created_at", seconds: CLIENT_SECRET_TTL_SECONDS },
    session: {
      type: "realtime",
      model: spec.model,
      instructions: spec.instructions,
      output_modalities: ["audio"],
      audio: {
        input,
        output: { voice: spec.voice },
      },
    },
  };
}

/**
 * Strip anything shaped like an OpenAI key from text that might be shown or
 * logged. OpenAI's own "incorrect API key" message quotes a masked form of the
 * key, so the pattern accepts asterisks too.
 */
export function redactKeys(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_*-]{4,}/g, "sk-[redacted]");
}

/**
 * A sentence for the player when minting a secret failed upstream.
 *
 * The status says what kind of problem it is; OpenAI's message, when there is
 * one, says which model or which limit, so it is appended rather than replaced.
 */
export function describeSecretFailure(
  status: number,
  upstreamMessage: string | undefined,
  model: string,
): string {
  const detail = upstreamMessage ? ` (${redactKeys(upstreamMessage)})` : "";
  switch (status) {
    case 401:
      return `OpenAI rejected that API key${detail}.`;
    case 403:
      return `That OpenAI account is not allowed to use the Realtime API${detail}.`;
    case 404:
      return `OpenAI reports that ${model} is not available to this key${detail}.`;
    case 429:
      return `OpenAI reports a rate limit or quota problem on this account${detail}.`;
    case 400:
      if (upstreamMessage && /model/i.test(upstreamMessage)) {
        return `OpenAI would not start a session on ${model}${detail}.`;
      }
      return `OpenAI rejected the session request${detail}.`;
    default:
      return `OpenAI returned ${status}${detail}.`;
  }
}

/** Token counts from one response.done event, flattened. */
export interface ResponseUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  inputText: number;
  inputAudio: number;
  outputText: number;
  outputAudio: number;
}

export const EMPTY_USAGE: ResponseUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  inputText: 0,
  inputAudio: 0,
  outputText: 0,
  outputAudio: 0,
};

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Read the usage block out of a server event, or null when it has none.
 *
 * Only response.done carries usage. The field names follow the API's
 * response.usage object; anything missing counts as zero rather than failing,
 * because a missing detail block must not lose the totals.
 */
export function usageFromResponseDone(event: unknown): ResponseUsage | null {
  const e = obj(event);
  if (e.type !== "response.done") {
    return null;
  }
  const usage = obj(obj(e.response).usage);
  if (!Object.keys(usage).length) {
    return null;
  }
  const inDetails = obj(usage.input_token_details);
  const outDetails = obj(usage.output_token_details);
  return {
    inputTokens: num(usage.input_tokens),
    outputTokens: num(usage.output_tokens),
    cachedTokens: num(inDetails.cached_tokens),
    inputText: num(inDetails.text_tokens),
    inputAudio: num(inDetails.audio_tokens),
    outputText: num(outDetails.text_tokens),
    outputAudio: num(outDetails.audio_tokens),
  };
}

export function sumUsage(list: readonly ResponseUsage[]): ResponseUsage {
  const total = { ...EMPTY_USAGE };
  for (const usage of list) {
    for (const key of Object.keys(total) as (keyof ResponseUsage)[]) {
      total[key] += usage[key];
    }
  }
  return total;
}
