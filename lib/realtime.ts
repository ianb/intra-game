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

/**
 * How quickly the character decides the player has finished talking.
 *
 * "quick" is the API's default server VAD, which answers about half a second
 * into any pause. That reads as an assistant filling silence. "patient" uses
 * semantic VAD at low eagerness, which waits for what sounds like the end of
 * a thought; "unhurried" is server VAD with a long silence window, for
 * players who think out loud slowly.
 */
export const TURN_TAKING = ["quick", "patient", "unhurried"] as const;
export type TurnTaking = (typeof TURN_TAKING)[number];
export const DEFAULT_TURN_TAKING: TurnTaking = "patient";

export function isTurnTaking(value: unknown): value is TurnTaking {
  return (TURN_TAKING as readonly unknown[]).includes(value);
}

/** The API's turn_detection object for a mode. Always explicit, so a live update can switch back to quick. */
export function turnDetectionFor(mode: TurnTaking): Record<string, unknown> {
  switch (mode) {
    case "patient":
      return { type: "semantic_vad", eagerness: "low" };
    case "unhurried":
      return {
        type: "server_vad",
        silence_duration_ms: 1500,
        prefix_padding_ms: 300,
      };
    default:
      return { type: "server_vad" };
  }
}

/** Which speech-to-speech service a session runs on. */
export const VOICE_PROVIDERS = ["openai", "gemini"] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];
export const PROVIDER_NAMES: Record<VoiceProvider, string> = {
  openai: "OpenAI",
  gemini: "Google",
};

export function isVoiceProvider(value: unknown): value is VoiceProvider {
  return (VOICE_PROVIDERS as readonly unknown[]).includes(value);
}

/** Everything an OpenAI Realtime session needs besides the credential. */
export interface RealtimeSessionSpec {
  provider?: "openai";
  model: RealtimeModel;
  voice: RealtimeVoice;
  instructions: string;
  transcribeInput?: boolean;
  turnTaking?: TurnTaking;
}

/**
 * What the browser posts to /api/realtime/secret: the key plus the session
 * spec for whichever provider. The Gemini spec lives in lib/geminilive.ts;
 * the Worker checks the fields it needs rather than the whole shape.
 */
export interface ClientSecretRequestBody {
  apiKey: string;
  provider?: VoiceProvider;
  model?: string;
  voice?: string;
  instructions?: string;
  transcribeInput?: boolean;
  turnTaking?: TurnTaking;
}

/** What /api/realtime/secret answers. Never the player's key. */
export interface ClientSecretResponse {
  provider: VoiceProvider;
  secret: string;
  /** Unix seconds when known; 0 when the provider did not say. */
  expiresAt: number;
  model: string;
  voice: string;
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
  const input: Record<string, unknown> = {
    turn_detection: turnDetectionFor(spec.turnTaking ?? DEFAULT_TURN_TAKING),
  };
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
 * Strip anything shaped like a credential from text that might be shown or
 * logged: OpenAI keys (whose own "incorrect API key" message quotes a masked
 * form, so asterisks are accepted), Google keys, and Gemini ephemeral tokens.
 */
export function redactKeys(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_*-]{4,}/g, "sk-[redacted]")
    .replace(/AIza[A-Za-z0-9_*-]{10,}/g, "AIza[redacted]")
    .replace(/auth_tokens\/[A-Za-z0-9_-]+/g, "auth_tokens/[redacted]");
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
  provider: VoiceProvider = "openai",
): string {
  const who = PROVIDER_NAMES[provider];
  const detail = upstreamMessage ? ` (${redactKeys(upstreamMessage)})` : "";
  switch (status) {
    case 401:
      return `${who} rejected that API key${detail}.`;
    case 403:
      return `That ${who} account is not allowed to use this API${detail}.`;
    case 404:
      return `${who} reports that ${model} is not available to this key${detail}.`;
    case 429:
      return `${who} reports a rate limit or quota problem on this account${detail}.`;
    case 400:
      // Google answers a bad key with 400 rather than 401.
      if (upstreamMessage && /api key/i.test(upstreamMessage)) {
        return `${who} rejected that API key${detail}.`;
      }
      if (upstreamMessage && /model/i.test(upstreamMessage)) {
        return `${who} would not start a session on ${model}${detail}.`;
      }
      return `${who} rejected the session request${detail}.`;
    default:
      return `${who} returned ${status}${detail}.`;
  }
}

/** Whether an upstream failure was the player's own account saying no. */
export function isAccountRefusal(
  status: number,
  upstreamMessage: string | undefined,
): boolean {
  return (
    [401, 403, 404, 429].includes(status) ||
    (status === 400 && !!upstreamMessage && /api key/i.test(upstreamMessage))
  );
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
