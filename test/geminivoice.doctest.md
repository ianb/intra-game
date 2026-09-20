# The life of a Gemini Live conversation

Same shape as `test/voice.doctest.md`, for the WebSocket provider. Everything
browser-specific comes in through `GeminiDeps`, so a fake socket, a fake
capture and a fake player are enough to walk the whole lifecycle.

```ts setup
import { GeminiVoiceConversation, rejectedSetupFields } from "../app/geminivoice.js";

class FakeTrack {
  enabled = true;
  stopped = false;
  stop() { this.stopped = true; }
}
class FakeStream {
  tracks = [new FakeTrack()];
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks; }
}
class FakeSocket {
  sent: any[] = [];
  closed = false;
  onopen: any = null;
  onmessage: any = null;
  onclose: any = null;
  onerror: any = null;
  constructor(public url: string) {}
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.closed = true; }
  // Test helpers: what the server does.
  open() { this.onopen?.(); }
  serve(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }); }
  serveBlob(message: unknown) {
    const text = JSON.stringify(message);
    this.onmessage?.({ data: { text: async () => text } });
  }
  drop(code?: number, reason?: string) { this.onclose?.({ code, reason }); }
}
class FakeCapture {
  stopped = false;
  muted = false;
  constructor(public onChunk: (b64: string) => void) {}
  stop() { this.stopped = true; }
  setMuted(m: boolean) { this.muted = m; }
  speak(b64: string) { if (!this.muted) { this.onChunk(b64); } }
}
class FakePlayer {
  played: string[] = [];
  flushes = 0;
  closed = false;
  play(b64: string) { this.played.push(b64); }
  flush() { this.flushes += 1; this.played = []; }
  close() { this.closed = true; }
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function rig({ mint }: { mint?: any } = {}) {
  rejectedSetupFields.clear();
  const stream = new FakeStream();
  const player = new FakePlayer();
  const log: string[] = [];
  let socket: FakeSocket | null = null;
  const sockets: FakeSocket[] = [];
  let capture: FakeCapture | null = null;
  let clock = 1_000_000;
  const deps = {
    getMicrophone: async () => { log.push("mic"); return stream; },
    mintSecret: async () => {
      log.push("mint");
      return mint ? mint.promise : { provider: "gemini", secret: "auth_tokens/tok", expiresAt: 0, model: "gemini-3.8-live", voice: "Sulafat" };
    },
    openSocket: (url: string) => { log.push("socket"); socket = new FakeSocket(url); sockets.push(socket); return socket; },
    startCapture: async (_stream: any, onChunk: (b64: string) => void) => { log.push("capture"); capture = new FakeCapture(onChunk); return capture; },
    createPlayer: () => { log.push("player"); return player; },
    now: () => clock,
  };
  const conversation = new GeminiVoiceConversation(
    {
      characterId: "Ama",
      characterName: "Ama",
      apiKey: "AIzaFake",
      openingLine: true,
      spec: { provider: "gemini", model: "gemini-3.8-live", voice: "Sulafat", instructions: "You are voicing Ama.", turnTaking: "patient", proactiveAudio: true },
    },
    deps as any,
  );
  return {
    conversation, stream, player, log,
    get socket() { return socket!; },
    sockets,
    get capture() { return capture!; },
    advance: (ms: number) => { clock += ms; },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const released = (r: ReturnType<typeof rig>) =>
  // The capture and the player only exist once setup completed; before that
  // there is nothing of theirs to release.
  [r.stream.tracks[0].stopped, r.socket?.closed ?? true, r.capture?.stopped ?? true, r.player.closed || !r.log.includes("player")]
    .map((v) => (v ? "y" : "n")).join("");
```

## A normal session

Start takes the microphone, mints a token, and opens the socket at the token's
URL. Nothing is sent until the socket opens; then the setup goes first:

```ts
const r = rig();
await r.conversation.start();
[r.conversation.state.value, r.log.join(" "), r.socket.url.includes("access_token=auth_tokens%2Ftok"), r.socket.sent.length].join(" | ");
=> connecting | mic mint socket | true | 0

r.socket.open();
const setup = r.socket.sent[0].setup;
[setup.model, setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, setup.systemInstruction.parts[0].text].join(" | ");
=> models/gemini-3.8-live | Sulafat | You are voicing Ama.
```

Once the server acknowledges the setup, the microphone starts streaming, the
speaker is ready, the state is connected, and the opening line is asked for as
a text turn:

``` continue
r.socket.serve({ setupComplete: {} });
await settle();
[r.conversation.state.value, r.log.slice(3).join(" "), r.socket.sent[1].clientContent.turnComplete, r.socket.sent[1].clientContent.turns[0].parts[0].text.startsWith("(Say one or two")].join(" | ");
=> connected | player capture | true | true

r.capture.speak("AAAA");
JSON.stringify(r.socket.sent.at(-1));
=> {"realtimeInput":{"audio":{"data":"AAAA","mimeType":"audio/pcm;rate=16000"}}}
```

Audio from the server plays; the transcript arrives in pieces and lands as
one line when the turn completes; usage adds up:

``` continue
r.socket.serve({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AQID" } }] }, outputTranscription: { text: "Now then, " } } });
r.socket.serve({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "BAUG" } }] }, outputTranscription: { text: "Ada." } } });
await settle();
[r.player.played.join(","), r.conversation.characterSpeaking.value, r.conversation.transcript.value.length].join(" | ");
=> AQID,BAUG | true | 0

r.socket.serve({ serverContent: { turnComplete: true }, usageMetadata: { promptTokenCount: 900, responseTokenCount: 120, responseTokensDetails: [{ modality: "AUDIO", tokenCount: 120 }] } });
await settle();
[r.conversation.characterSpeaking.value, r.conversation.transcript.value.map((l) => `${l.who}: ${l.text}`).join(" / "), r.conversation.usage().inputTokens, r.conversation.usage().outputAudio].join(" | ");
=> false | character: Now then, Ada. | 900 | 120
```

The player's words, when transcription is on, are committed when the
character starts answering; an interruption flushes the speaker:

``` continue
r.socket.serve({ serverContent: { inputTranscription: { text: "What year " } } });
r.socket.serve({ serverContent: { inputTranscription: { text: "is it?" } } });
await settle();
r.conversation.playerSpeaking.value;
=> true

r.socket.serve({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "Bwg=" } }] } } });
await settle();
[r.conversation.playerSpeaking.value, r.conversation.transcript.value.at(-1).who, r.conversation.transcript.value.at(-1).text].join(" | ");
=> false | player | What year is it?

r.socket.serve({ serverContent: { interrupted: true } });
await settle();
[r.player.flushes, r.player.played.length, r.conversation.characterSpeaking.value].join(" ");
=> 1 0 false
```

Messages may arrive as Blobs; they are still handled, in order:

``` continue
r.socket.serveBlob({ serverContent: { outputTranscription: { text: "Blob " } } });
r.socket.serve({ serverContent: { outputTranscription: { text: "order" }, turnComplete: true } });
await settle();
await settle();
r.conversation.transcript.value.at(-1).text;
=> Blob order
```

Mute stops chunks at the capture, and the track is disabled too. A go-away
warning is shown, not acted on:

``` continue
r.conversation.setMuted(true);
const before = r.socket.sent.length;
r.capture.speak("BBBB");
[r.capture.muted, r.stream.tracks[0].enabled, r.socket.sent.length === before].join(" ");
=> true false true

r.conversation.setMuted(false);
r.socket.serve({ goAway: { timeLeft: "30s" } });
await settle();
r.conversation.notice.value;
=> Google will end this session in about 30 seconds.
```

Ending releases everything, and late messages are dropped:

``` continue
r.advance(30_000);
r.conversation.end("Ended.");
[r.conversation.state.value, r.conversation.elapsedSeconds(), released(r)].join(" | ");
=> ended | 30 | yyyy

r.socket.serve({ serverContent: { outputTranscription: { text: "Still here?" }, turnComplete: true } });
await settle();
r.conversation.transcript.value.at(-1).text;
=> Blob order
```

## Ended early

Cancelled while the token is being minted: the token arrives and no socket is
opened.

```ts
const mint = deferred<any>();
const r = rig({ mint });
void r.conversation.start();
await settle();
r.conversation.end("Cancelled.");
mint.resolve({ provider: "gemini", secret: "auth_tokens/late", expiresAt: 0, model: "gemini-3.8-live", voice: "Sulafat" });
await settle();
await settle();
[r.conversation.state.value, r.log.join(" "), r.stream.tracks[0].stopped].join(" | ");
=> ended | mic mint | true
```

## A refused setup field

Google rejects setup fields it does not know for a model or the token method
by closing the socket and naming the field. For the optional ones, the session
says so, remembers it for the page, and reconnects on a fresh token with the
field left out. The microphone is kept across the retry.

```ts
const r = rig();
await r.conversation.start();
r.socket.open();
"proactivity" in r.socket.sent[0].setup;
=> true

r.socket.drop(1007, `Invalid JSON payload received. Unknown name "proactivity" at 'setup': Cannot find field.`);
await settle();
await settle();
[r.conversation.state.value, r.conversation.notice.value, r.log.join(" "), r.sockets.length, r.stream.tracks[0].stopped].join(" | ");
=> connecting | Google does not accept proactive audio for this model; continuing without it. | mic mint socket mint socket | 2 | false

r.socket.open();
["proactivity" in r.socket.sent[0].setup, [...rejectedSetupFields].join(",")].join(" | ");
=> false | proactivity

r.socket.serve({ setupComplete: {} });
await settle();
r.conversation.state.value;
=> connected
```

A refusal of something the session cannot do without, or a second refusal of
the same field, is a failure to start:

```ts
const r = rig();
await r.conversation.start();
r.socket.open();
r.socket.drop(1007, `Invalid JSON payload received. Unknown name "systemInstruction" at 'setup': Cannot find field.`);
[r.conversation.state.value, r.conversation.error.value?.includes("systemInstruction")].join(" | ");
=> error | true
```

Closed by the server before setup completed is a failure to start, with the
close reason and no credential in it:

```ts
const r = rig();
await r.conversation.start();
r.socket.open();
r.socket.drop(1008, "Invalid token auth_tokens/tok for this method");
[r.conversation.state.value, r.conversation.error.value, released(r)].join(" | ");
=> error | Google closed the connection before the session started (1008: Invalid token auth_tokens/[redacted] for this method). | yyyy
```

Closed after: the conversation is over, nothing reconnects.

```ts
const r = rig();
await r.conversation.start();
r.socket.open();
r.socket.serve({ setupComplete: {} });
await settle();
r.socket.drop(1000, "");
[r.conversation.state.value, r.conversation.endedBecause.value, released(r)].join(" | ");
=> ended | The connection ended. | yyyy
```

A denied microphone is the same sentence as on OpenAI:

```ts
const r = rig();
(r.conversation as any).deps.getMicrophone = async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); };
await r.conversation.start();
[r.conversation.state.value, r.conversation.error.value].join(" | ");
=> error | Microphone access was denied. Allow the microphone and try again.
```
