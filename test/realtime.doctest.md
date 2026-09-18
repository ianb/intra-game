# Minting a Realtime client secret with the player's own key

The voice experiment runs on the player's OpenAI account. The browser sends the
key to one same-origin endpoint, which uses it for a single upstream call and
answers with a short-lived client secret. The key is not stored, not logged,
and not repeated in any error, and there is no fallback to the deployment's own
credentials.

```ts setup
import { CLIENT_SECRETS_URL, mintClientSecret } from "../worker/realtime.js";
import {
  describeSecretFailure,
  redactKeys,
  sumUsage,
  usageFromResponseDone,
} from "../lib/realtime.js";

const KEY = "sk-test-1234567890abcdef";
const good = {
  apiKey: KEY,
  model: "gpt-realtime-2.1-mini",
  voice: "marin",
  instructions: "You are voicing Ama.",
};

function post(body: unknown, method = "POST") {
  return new Request("https://intra.example/api/realtime/secret", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

// A stand-in for OpenAI: records the one request and answers as told.
function upstream(status: number, body: unknown) {
  const seen: { url?: string; init?: RequestInit; calls: number } = { calls: 0 };
  const fetcher = (async (url: string, init: RequestInit) => {
    seen.calls += 1;
    seen.url = url;
    seen.init = init;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { seen, fetcher };
}

async function result(response: Response) {
  const text = await response.text();
  return { status: response.status, text, data: JSON.parse(text) };
}
```

## The happy path

One request to OpenAI's client-secrets endpoint, carrying the key in the
Authorization header and the session configuration in the body:

```ts
const { seen, fetcher } = upstream(200, { value: "ek_abc123", expires_at: 1700000600 });
const { status, data } = await result(await mintClientSecret(post(good), fetcher));
[status, data.secret, data.expiresAt, data.model, data.voice].join(" ");
=> 200 ek_abc123 1700000600 gpt-realtime-2.1-mini marin

seen.url;
=> https://api.openai.com/v1/realtime/client_secrets

(seen.init!.headers as Record<string, string>).authorization;
=> Bearer sk-test-1234567890abcdef

const sent = JSON.parse(seen.init!.body as string);
[sent.session.type, sent.session.model, sent.session.audio.output.voice, sent.session.instructions].join(" | ");
=> realtime | gpt-realtime-2.1-mini | marin | You are voicing Ama.
```

The key goes in the header and nowhere else: not in the upstream body, and not
in what the browser gets back.

``` continue
(seen.init!.body as string).includes(KEY);
=> false

const again = await result(await mintClientSecret(post(good), fetcher));
again.text.includes(KEY);
=> false
```

## Refusals before any upstream call

A missing or malformed key, an unlisted model or voice, or empty instructions
are answered here, and OpenAI is never contacted:

```ts
const { seen, fetcher } = upstream(200, { value: "ek_never" });
const cases = [
  { ...good, apiKey: "" },
  { ...good, apiKey: "not-a-key" },
  { ...good, model: "gpt-4o-realtime-preview" },
  { ...good, voice: "morgan" },
  { ...good, turnTaking: "instant" },
  { ...good, instructions: "" },
];
const answers = await Promise.all(cases.map(async (body) => {
  const { status, data } = await result(await mintClientSecret(post(body), fetcher));
  return `${status} ${data.error}`;
}));
answers.join("\n");
=> 400 An OpenAI API key is required.
400 That does not look like an OpenAI API key; they start with sk-.
400 That model is not one this game offers.
400 That voice is not one this game offers.
400 That turn-taking setting is not one this game offers.
400 Missing or oversized instructions.

seen.calls;
=> 0

(await mintClientSecret(post(good, "GET"), fetcher)).status;
=> 405
```

## When OpenAI says no

The account's own refusals come back with their status and a sentence. OpenAI
quotes a masked form of a rejected key in its message, and that is redacted
too:

```ts
const rejected = { error: { message: "Incorrect API key provided: sk-test-****cdef. You can find your API key at platform.openai.com." } };
const { status, data, text } = await result(await mintClientSecret(post(good), upstream(401, rejected).fetcher));
[status, data.error].join(" ");
=> 401 OpenAI rejected that API key (Incorrect API key provided: sk-[redacted]. You can find your API key at platform.openai.com.).

text.includes("sk-test");
=> false
```

An unavailable model is reported as such rather than swapped for another:

```ts
const { status, data } = await result(await mintClientSecret(
  post({ ...good, model: "gpt-realtime-2.1" }),
  upstream(404, { error: { message: "The model `gpt-realtime-2.1` does not exist or you do not have access to it." } }).fetcher,
));
[status, data.error].join(" ");
=> 404 OpenAI reports that gpt-realtime-2.1 is not available to this key (The model `gpt-realtime-2.1` does not exist or you do not have access to it.).
```

Quota problems keep their status so the panel can say what kind of problem it
is; anything else from upstream is a bad gateway from where the browser sits:

```ts
(await mintClientSecret(post(good), upstream(429, { error: { message: "You exceeded your current quota" } }).fetcher)).status;
=> 429

const { status, data } = await result(await mintClientSecret(post(good), upstream(500, "upstream exploded").fetcher));
[status, data.error].join(" ");
=> 502 OpenAI returned 500 (upstream exploded).

const unreachable = (async () => { throw new Error("getaddrinfo ENOTFOUND"); }) as unknown as typeof fetch;
const down = await result(await mintClientSecret(post(good), unreachable));
[down.status, down.data.error].join(" ");
=> 502 Could not reach OpenAI: Error: getaddrinfo ENOTFOUND

const empty = await result(await mintClientSecret(post(good), upstream(200, { session: {} }).fetcher));
[empty.status, empty.data.error].join(" ");
=> 502 OpenAI did not return a client secret.
```

## The helpers

Redaction catches full and masked keys and leaves ordinary text alone:

```ts
redactKeys("key sk-abcdefghij1234 and sk-proj-****wxyz; ask about tasks");
=> key sk-[redacted] and sk-[redacted]; ask about tasks
```

A 400 that mentions the model is a model problem:

```ts
describeSecretFailure(400, "Unsupported model: gpt-realtime-2.1", "gpt-realtime-2.1");
=> OpenAI would not start a session on gpt-realtime-2.1 (Unsupported model: gpt-realtime-2.1).

describeSecretFailure(403, undefined, "gpt-realtime-2.1-mini");
=> That OpenAI account is not allowed to use the Realtime API.
```

Usage is read from `response.done` only, with missing detail blocks counting
as zero rather than failing:

```ts
const done = {
  type: "response.done",
  response: {
    usage: {
      input_tokens: 1200, output_tokens: 340,
      input_token_details: { cached_tokens: 900, text_tokens: 1000, audio_tokens: 200 },
      output_token_details: { text_tokens: 40, audio_tokens: 300 },
    },
  },
};
JSON.stringify(usageFromResponseDone(done));
=> {"inputTokens":1200,"outputTokens":340,"cachedTokens":900,"inputText":1000,"inputAudio":200,"outputText":40,"outputAudio":300}

usageFromResponseDone({ type: "response.created", response: { usage: null } });
=> null

const bare = usageFromResponseDone({ type: "response.done", response: { usage: { input_tokens: 5, output_tokens: 7 } } });
JSON.stringify(sumUsage([bare!, usageFromResponseDone(done)!]));
=> {"inputTokens":1205,"outputTokens":347,"cachedTokens":900,"inputText":1000,"inputAudio":200,"outputText":40,"outputAudio":300}
```
