import {
  clientSecretRequest,
  describeSecretFailure,
  isAccountRefusal,
  isRealtimeModel,
  isRealtimeVoice,
  isTurnTaking,
  redactKeys,
  type ClientSecretRequestBody,
  type ClientSecretResponse,
  type RealtimeSessionSpec,
  type VoiceProvider,
} from "../lib/realtime";
import {
  geminiTokenRequest,
  geminiTokenUrl,
  isGeminiModel,
  isGeminiVoice,
} from "../lib/geminilive";

/**
 * Turn the player's own API key into a short-lived credential for a voice
 * session: an OpenAI Realtime client secret, or a Gemini Live ephemeral token.
 *
 * The key arrives in the request body, goes into one upstream header, and is
 * not kept: not in storage, not in a log line, not in an error. The router
 * logs method and path only, and nothing here reads the body into anything
 * but the parsed object below. There is no fallback to the deployment's own
 * credentials; this spends the player's account or nothing.
 *
 * The browser then connects to the provider directly with the credential, so
 * the media never touches the Worker.
 */

export const CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/client_secrets";

/** Generous; a character prompt with history is a few thousand characters. */
const MAX_INSTRUCTIONS = 60_000;

export async function mintClientSecret(
  request: Request,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  let body: Partial<ClientSecretRequestBody> & Record<string, unknown>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const provider: VoiceProvider =
    body.provider === "gemini" ? "gemini" : "openai";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return json(
      {
        error: `${provider === "gemini" ? "A Google AI" : "An OpenAI"} API key is required.`,
      },
      400,
    );
  }
  if (provider === "openai" && !apiKey.startsWith("sk-")) {
    return json(
      {
        error:
          "That does not look like an OpenAI API key; they start with sk-.",
      },
      400,
    );
  }
  if (provider === "gemini" && !apiKey.startsWith("AIza")) {
    return json(
      {
        error:
          "That does not look like a Google AI API key; they start with AIza.",
      },
      400,
    );
  }
  const modelOk =
    provider === "gemini"
      ? isGeminiModel(body.model)
      : isRealtimeModel(body.model);
  if (!modelOk) {
    return json({ error: "That model is not one this game offers." }, 400);
  }
  const voiceOk =
    provider === "gemini"
      ? isGeminiVoice(body.voice)
      : isRealtimeVoice(body.voice);
  if (!voiceOk) {
    return json({ error: "That voice is not one this game offers." }, 400);
  }
  if (body.turnTaking !== undefined && !isTurnTaking(body.turnTaking)) {
    return json(
      { error: "That turn-taking setting is not one this game offers." },
      400,
    );
  }
  const instructions =
    typeof body.instructions === "string" ? body.instructions : "";
  if (!instructions || instructions.length > MAX_INSTRUCTIONS) {
    return json({ error: "Missing or oversized instructions." }, 400);
  }
  const model = body.model as string;
  const voice = body.voice as string;

  const upstream =
    provider === "gemini"
      ? await mintGemini(apiKey, fetcher, now)
      : await mintOpenAI(
          apiKey,
          {
            model: model as RealtimeSessionSpec["model"],
            voice: voice as RealtimeSessionSpec["voice"],
            instructions,
            transcribeInput: body.transcribeInput === true,
            turnTaking: body.turnTaking,
          },
          fetcher,
        );
  if ("error" in upstream) {
    return json({ error: upstream.error }, upstream.status);
  }
  const response: ClientSecretResponse = {
    provider,
    secret: upstream.secret,
    expiresAt: upstream.expiresAt,
    model,
    voice,
  };
  return json(response);
}

type Minted =
  { secret: string; expiresAt: number } | { error: string; status: number };

/**
 * OpenAI: the session configuration rides inside the secret, so the browser
 * never has to send instructions over the data channel before the character
 * can speak.
 */
async function mintOpenAI(
  apiKey: string,
  spec: RealtimeSessionSpec,
  fetcher: typeof fetch,
): Promise<Minted> {
  let upstream: Response;
  try {
    upstream = await fetcher(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(clientSecretRequest(spec)),
    });
  } catch (e) {
    return unreachable("OpenAI", e);
  }
  const text = await upstream.text();
  if (!upstream.ok) {
    return refused(upstream.status, text, spec.model, "openai");
  }
  const minted = parseJson(text) as { value?: unknown; expires_at?: unknown };
  if (!minted) {
    return {
      error: "OpenAI answered with something other than JSON.",
      status: 502,
    };
  }
  if (typeof minted.value !== "string" || !minted.value) {
    return { error: "OpenAI did not return a client secret.", status: 502 };
  }
  return {
    secret: minted.value,
    expiresAt: typeof minted.expires_at === "number" ? minted.expires_at : 0,
  };
}

/**
 * Gemini: an ephemeral token with one use and short windows. The browser
 * sends the session setup itself, so nothing about the session is decided
 * here beyond the token.
 */
async function mintGemini(
  apiKey: string,
  fetcher: typeof fetch,
  now: () => number,
): Promise<Minted> {
  let upstream: Response;
  try {
    upstream = await fetcher(geminiTokenUrl(), {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(geminiTokenRequest(now())),
    });
  } catch (e) {
    return unreachable("Google", e);
  }
  const text = await upstream.text();
  if (!upstream.ok) {
    return refused(upstream.status, text, "the Live API", "gemini");
  }
  const minted = parseJson(text) as { name?: unknown; expireTime?: unknown };
  if (!minted) {
    return {
      error: "Google answered with something other than JSON.",
      status: 502,
    };
  }
  if (typeof minted.name !== "string" || !minted.name) {
    return { error: "Google did not return a token.", status: 502 };
  }
  const expires =
    typeof minted.expireTime === "string" ? Date.parse(minted.expireTime) : NaN;
  return {
    secret: minted.name,
    expiresAt: Number.isFinite(expires) ? Math.floor(expires / 1000) : 0,
  };
}

function unreachable(who: string, e: unknown): Minted {
  return {
    error: `Could not reach ${who}: ${redactKeys(String(e))}`,
    status: 502,
  };
}

/**
 * The player's own account said no, so its status is theirs to see; anything
 * else from upstream is a bad gateway from where the browser sits.
 */
function refused(
  status: number,
  text: string,
  model: string,
  provider: VoiceProvider,
): Minted {
  const message = upstreamMessage(text);
  return {
    error: describeSecretFailure(status, message, model, provider),
    status: isAccountRefusal(status, message)
      ? status === 400
        ? 401
        : status
      : 502,
  };
}

/** Both providers use an { error: { message } } envelope; take the message if it is there. */
function upstreamMessage(text: string): string | undefined {
  const parsed = parseJson(text) as { error?: { message?: unknown } } | null;
  const message = parsed?.error?.message;
  if (typeof message === "string") {
    return message.slice(0, 300);
  }
  return text ? text.slice(0, 300) : undefined;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
