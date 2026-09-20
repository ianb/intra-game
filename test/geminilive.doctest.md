# Gemini Live: the token, the setup, and what comes back

The second voice provider. Gemini Live is a WebSocket rather than WebRTC, so
the shapes here are what the browser sends and reads on that socket, plus the
ephemeral token the Worker mints for it. The Worker's endpoint is the same one
OpenAI uses, branched on `provider`.

```ts setup
import { mintClientSecret } from "../worker/realtime.js";
import {
  geminiActivityDetection,
  geminiAudioMessage,
  geminiSetupMessage,
  geminiSocketUrl,
  geminiTokenRequest,
  geminiTokenUrl,
  readGeminiMessage,
  unknownSetupField,
  usageFromGeminiMessage,
  GEMINI_VOICES,
} from "../lib/geminilive.js";
import { redactKeys } from "../lib/realtime.js";

const KEY = "AIzaSyFakeKey1234567890abcdefghijklmnop";
const good = {
  provider: "gemini",
  apiKey: KEY,
  model: "gemini-3.8-live",
  voice: "Sulafat",
  instructions: "You are voicing Ama.",
};

function post(body: unknown) {
  return new Request("https://intra.example/api/realtime/secret", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

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

const NOW = Date.parse("2026-09-19T12:00:00Z");
```

## Minting a token

One request to the auth_tokens endpoint with the key in Google's header. The
token is single-use with short windows, and carries no session constraints:
the browser sends the setup itself.

```ts
const { seen, fetcher } = upstream(200, { name: "auth_tokens/abc123", expireTime: "2026-09-19T12:30:00Z" });
const { status, data } = await result(await mintClientSecret(post(good), fetcher, () => NOW));
[status, data.provider, data.secret, data.expiresAt, data.model, data.voice].join(" ");
=> 200 gemini auth_tokens/abc123 1789821000 gemini-3.8-live Sulafat

seen.url;
=> https://generativelanguage.googleapis.com/v1beta/auth_tokens

(seen.init!.headers as Record<string, string>)["x-goog-api-key"];
=> AIzaSyFakeKey1234567890abcdefghijklmnop

JSON.parse(seen.init!.body as string);
=> {
  "uses": 1,
  "expireTime": "2026-09-19T12:30:00.000Z",
  "newSessionExpireTime": "2026-09-19T12:02:00.000Z"
}
```

The key goes in the header and nowhere else:

``` continue
(seen.init!.body as string).includes(KEY);
=> false

const again = await result(await mintClientSecret(post(good), fetcher, () => NOW));
again.text.includes("AIzaSy");
=> false
```

Refusals before any upstream call. Google keys come in more than one shape,
so the only key check is against an OpenAI key pasted in the wrong slot:

```ts
const { seen, fetcher } = upstream(200, { name: "auth_tokens/never" });
const cases = [
  { ...good, apiKey: "sk-this-is-an-openai-key" },
  { ...good, model: "gemini-2.5-flash" },
  { ...good, voice: "marin" },
];
const answers = await Promise.all(cases.map(async (body) => {
  const { status, data } = await result(await mintClientSecret(post(body), fetcher));
  return `${status} ${data.error}`;
}));
answers.join("\n");
=> 400 That looks like an OpenAI key; this slot is for a Google AI key.
400 That model is not one this game offers.
400 That voice is not one this game offers.

seen.calls;
=> 0
```

Google answers a bad key with a 400, not a 401. It is still the account
saying no, so it comes back as 401 with the key redacted:

```ts
const rejected = { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } };
const { status, data } = await result(await mintClientSecret(post(good), upstream(400, rejected).fetcher));
[status, data.error].join(" ");
=> 401 Google rejected that API key (API key not valid. Please pass a valid API key.).

const quota = await result(await mintClientSecret(post(good), upstream(429, { error: { message: "Quota exceeded" } }).fetcher));
[quota.status, quota.data.error].join(" ");
=> 429 Google reports a rate limit or quota problem on this account (Quota exceeded).
```

## The socket

A token connects through the Constrained method with the token as a query
parameter, because a browser WebSocket cannot set headers:

```ts
geminiSocketUrl("auth_tokens/abc123");
=> wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=auth_tokens%2Fabc123

geminiTokenUrl();
=> https://generativelanguage.googleapis.com/v1beta/auth_tokens
```

The first message is the setup: model, voice, the prompt as the system
instruction, audio out, the character's transcript on, context compression
on so the 15-minute cap does not apply. Input transcription, proactive audio
and affective dialog are opt-in:

```ts
const setup = geminiSetupMessage({ provider: "gemini", model: "gemini-3.8-live", voice: "Sulafat", instructions: "Hello", turnTaking: "quick" }).setup as any;
[
  setup.model,
  setup.generationConfig.responseModalities.join(","),
  setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
  setup.systemInstruction.parts[0].text,
  JSON.stringify(setup.outputAudioTranscription),
  JSON.stringify(setup.contextWindowCompression),
  "inputAudioTranscription" in setup,
  "proactivity" in setup,
  "enableAffectiveDialog" in setup.generationConfig,
].join(" | ");
=> models/gemini-3.8-live | AUDIO | Sulafat | Hello | {} | {"slidingWindow":{}} | false | false | false

const full = geminiSetupMessage({
  provider: "gemini", model: "gemini-3.8-live", voice: "Kore", instructions: "Hi",
  transcribeInput: true, proactiveAudio: true, affectiveDialog: true, turnTaking: "unhurried",
}).setup as any;
[
  JSON.stringify(full.inputAudioTranscription),
  JSON.stringify(full.proactivity),
  full.generationConfig.enableAffectiveDialog,
  JSON.stringify(full.realtimeInputConfig.automaticActivityDetection),
].join(" | ");
=> {} | {"proactiveAudio":true} | true | {"endOfSpeechSensitivity":"END_SENSITIVITY_LOW","silenceDurationMs":1500,"prefixPaddingMs":300}
```

Google refuses setup fields it does not know for a model or a method by
closing the socket and naming the field. The session reads the name, and the
setup can be built without it:

```ts
unknownSetupField(`Invalid JSON payload received. Unknown name "proactivity" at 'setup': Cannot find field.`);
=> proactivity

unknownSetupField("Internal error");
=> null

const trimmed = geminiSetupMessage(
  { provider: "gemini", model: "gemini-3.8-live", voice: "Kore", instructions: "Hi", proactiveAudio: true, affectiveDialog: true },
  new Set(["proactivity", "enableAffectiveDialog"]),
).setup as any;
["proactivity" in trimmed, trimmed.proactiveAudio, "enableAffectiveDialog" in trimmed.generationConfig, "contextWindowCompression" in trimmed].join(" ");
=> false true false true
```

The docs nest proactive audio; a js-genai issue reports gemini-3.8-live taking
it flat instead. The setup tries the documented form first, then the flat one
once the nested one is refused, then goes without:

```ts
const flatToo = geminiSetupMessage(
  { provider: "gemini", model: "gemini-3.8-live", voice: "Kore", instructions: "Hi", proactiveAudio: true },
  new Set(["proactivity", "proactiveAudio"]),
).setup as any;
["proactivity" in flatToo, "proactiveAudio" in flatToo].join(" ");
=> false false
```

Turn-taking maps onto activity detection. Quick is Google's default, so it
sends nothing:

```ts
[
  JSON.stringify(geminiActivityDetection("quick")),
  JSON.stringify(geminiActivityDetection("patient")),
].join(" | ");
=> {} | {"endOfSpeechSensitivity":"END_SENSITIVITY_LOW","silenceDurationMs":800}
```

Microphone audio goes up as base64 PCM with its rate in the mime type:

```ts
JSON.stringify(geminiAudioMessage("AAAA"));
=> {"realtimeInput":{"audio":{"data":"AAAA","mimeType":"audio/pcm;rate=16000"}}}
```

## Reading what comes back

Server messages are read into one flat event. Audio parts, transcripts, the
turn flags, usage and the go-away warning each land in their own field:

```ts
const spoken = readGeminiMessage({
  serverContent: {
    modelTurn: { parts: [
      { inlineData: { mimeType: "audio/pcm;rate=24000", data: "AQID" } },
      { inlineData: { mimeType: "audio/pcm;rate=24000", data: "BAUG" } },
      { text: "ignored: not audio" },
    ] },
    outputTranscription: { text: "Hello, Ada." },
  },
});
[spoken.audio.join(","), spoken.outputTranscript, spoken.turnComplete, spoken.setupComplete].join(" | ");
=> AQID,BAUG | Hello, Ada. | false | false

const done = readGeminiMessage({ serverContent: { turnComplete: true }, usageMetadata: {
  promptTokenCount: 1500, responseTokenCount: 400, cachedContentTokenCount: 0,
  promptTokensDetails: [{ modality: "TEXT", tokenCount: 1200 }, { modality: "AUDIO", tokenCount: 300 }],
  responseTokensDetails: [{ modality: "AUDIO", tokenCount: 400 }],
} });
[done.turnComplete, JSON.stringify(done.usage)].join(" | ");
=> true | {"inputTokens":1500,"outputTokens":400,"cachedTokens":0,"inputText":1200,"inputAudio":300,"outputText":0,"outputAudio":400}

readGeminiMessage({ setupComplete: {} }).setupComplete;
=> true

readGeminiMessage({ serverContent: { interrupted: true } }).interrupted;
=> true

readGeminiMessage({ goAway: { timeLeft: "42s" } }).goAwaySeconds;
=> 42

readGeminiMessage({ serverContent: { inputTranscription: { text: "Hi Ama" } } }).inputTranscript;
=> Hi Ama

usageFromGeminiMessage({ serverContent: {} });
=> null
```

## Housekeeping

Google keys and ephemeral tokens are redacted like OpenAI keys:

```ts
redactKeys("key AIzaSyFakeKey1234567890abcdefghijklmnop or AQ.Ab8RN6Jm0123456789abc then auth_tokens/abc123def and sk-abcdefghij");
=> key AIza[redacted] or AQ.[redacted] then auth_tokens/[redacted] and sk-[redacted]

GEMINI_VOICES.length;
=> 30
```
