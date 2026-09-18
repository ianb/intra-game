import {
  clientSecretRequest,
  describeSecretFailure,
  isRealtimeModel,
  isRealtimeVoice,
  isTurnTaking,
  redactKeys,
  type ClientSecretRequestBody,
  type ClientSecretResponse,
} from "../lib/realtime";

/**
 * Mint a short-lived Realtime client secret with the player's own OpenAI key.
 *
 * The key arrives in the request body, goes into one upstream Authorization
 * header, and is not kept: not in storage, not in a log line, not in an
 * error. The router logs method and path only, and nothing here reads the
 * body into anything but the parsed object below. There is no fallback to the
 * deployment's own credentials; this spends the player's account or nothing.
 *
 * The browser then connects to OpenAI directly with the secret, so the media
 * never touches the Worker.
 */

export const CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/client_secrets";

/** Generous; a character prompt with history is a few thousand characters. */
const MAX_INSTRUCTIONS = 60_000;

export async function mintClientSecret(
  request: Request,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  let body: Partial<ClientSecretRequestBody>;
  try {
    body = (await request.json()) as Partial<ClientSecretRequestBody>;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return json({ error: "An OpenAI API key is required." }, 400);
  }
  if (!apiKey.startsWith("sk-")) {
    return json(
      {
        error:
          "That does not look like an OpenAI API key; they start with sk-.",
      },
      400,
    );
  }
  if (!isRealtimeModel(body.model)) {
    return json({ error: "That model is not one this game offers." }, 400);
  }
  if (!isRealtimeVoice(body.voice)) {
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
  const spec = {
    model: body.model,
    voice: body.voice,
    instructions,
    transcribeInput: body.transcribeInput === true,
    turnTaking: body.turnTaking,
  };

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
    return json(
      { error: `Could not reach OpenAI: ${redactKeys(String(e))}` },
      502,
    );
  }
  const text = await upstream.text();
  if (!upstream.ok) {
    const message = describeSecretFailure(
      upstream.status,
      upstreamMessage(text),
      spec.model,
    );
    // The player's own account said no, so the status is theirs to see;
    // anything else from OpenAI is a bad gateway from where the browser sits.
    const status = [401, 403, 404, 429].includes(upstream.status)
      ? upstream.status
      : 502;
    return json({ error: message }, status);
  }
  let minted: { value?: unknown; expires_at?: unknown };
  try {
    minted = JSON.parse(text) as { value?: unknown; expires_at?: unknown };
  } catch {
    return json(
      { error: "OpenAI answered with something other than JSON." },
      502,
    );
  }
  if (typeof minted.value !== "string" || !minted.value) {
    return json({ error: "OpenAI did not return a client secret." }, 502);
  }
  const response: ClientSecretResponse = {
    secret: minted.value,
    expiresAt: typeof minted.expires_at === "number" ? minted.expires_at : 0,
    model: spec.model,
    voice: spec.voice,
  };
  return json(response);
}

/** OpenAI's error envelope is { error: { message } }; take the message if it is there. */
function upstreamMessage(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: unknown } };
    const message = parsed.error?.message;
    return typeof message === "string" ? message.slice(0, 300) : undefined;
  } catch {
    return text ? text.slice(0, 300) : undefined;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
