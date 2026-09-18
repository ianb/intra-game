# The life of a voice conversation

`VoiceConversation` owns the microphone, the peer connection, the data channel
and the audio element for one spoken session, and every browser API it uses
comes in through `VoiceDeps`. With fakes in their place the whole lifecycle
runs in Node: start, talk, mute, end, and the awkward cases where the player
ends it while it is still being set up.

```ts setup
import { VoiceConversation, describeStartError } from "../app/voice.js";

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
class FakeChannel {
  readyState = "connecting";
  sent: any[] = [];
  closed = false;
  onopen: any = null;
  onmessage: any = null;
  onclose: any = null;
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.closed = true; this.readyState = "closed"; }
  open() { this.readyState = "open"; this.onopen?.(); }
}
class FakePeer {
  closed = false;
  tracks: any[] = [];
  remote: any = null;
  connectionState = "new";
  ontrack: any = null;
  onconnectionstatechange: any = null;
  channel = new FakeChannel();
  addTrack(track: any) { this.tracks.push(track); }
  createDataChannel() { return this.channel; }
  async createOffer() { return { type: "offer", sdp: "v=0 offer" }; }
  async setLocalDescription() {}
  async setRemoteDescription(description: any) { this.remote = description; }
  close() { this.closed = true; }
  setState(state: string) { this.connectionState = state; this.onconnectionstatechange?.(); }
}
class FakeAudio {
  srcObject: any = null;
  paused = false;
  autoplay = false;
  pause() { this.paused = true; }
}

// A promise the test resolves by hand, to hold a step open.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function rig({ mint, call, mic }: { mint?: any; call?: any; mic?: any } = {}) {
  const stream = new FakeStream();
  const peer = new FakePeer();
  const audio = new FakeAudio();
  const log: string[] = [];
  let clock = 1_000_000;
  const deps = {
    getMicrophone: async () => { log.push("mic"); if (mic) { return mic.promise; } return stream; },
    mintSecret: async (spec: any) => {
      log.push("mint");
      return mint ? mint.promise : { secret: "ek_test", expiresAt: 0, model: spec.model, voice: spec.voice };
    },
    createPeer: () => { log.push("peer"); return peer; },
    connectCall: async (secret: string) => { log.push(`call:${secret}`); return call ? call.promise : "v=0 answer"; },
    createAudio: () => audio,
    now: () => clock,
  };
  const conversation = new VoiceConversation(
    {
      characterId: "Ama",
      characterName: "Ama",
      apiKey: "sk-test",
      openingLine: true,
      spec: { model: "gpt-realtime-2.1-mini", voice: "marin", instructions: "You are voicing Ama." },
    },
    deps as any,
  );
  return { conversation, stream, peer, audio, log, advance: (ms: number) => { clock += ms; } };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const released = (r: ReturnType<typeof rig>) =>
  [r.stream.tracks[0].stopped, r.peer.closed, r.peer.channel.closed, r.audio.paused, r.audio.srcObject === null]
    .map((v) => (v ? "y" : "n")).join("");
```

## A normal session

Starting takes the microphone, mints a secret with the player's key, builds
the peer connection with the mic track on it, and posts the offer with the
secret. It is "connected" once the data channel opens, and the first thing sent
is the opening line request:

```ts
const r = rig();
const { conversation, peer, log } = r;
await conversation.start();
[conversation.state.value, log.join(" "), peer.tracks.length, peer.remote.sdp].join(" | ");
=> connecting | mic mint peer call:ek_test | 1 | v=0 answer

peer.channel.open();
[conversation.state.value, peer.channel.sent[0].type, conversation.inProgress].join(" ");
=> connected response.create true
```

The character's spoken lines and the API's usage figures come in over the
channel:

``` continue
conversation.handleServerEvent({ type: "response.output_audio_transcript.delta", delta: "Hello, " });
conversation.handleServerEvent({ type: "response.output_audio_transcript.delta", delta: "Ada." });
conversation.characterSpeaking.value;
=> true

conversation.handleServerEvent({ type: "response.output_audio_transcript.done", transcript: "Hello, Ada." });
conversation.handleServerEvent({ type: "conversation.item.input_audio_transcription.completed", transcript: "Hi Ama." });
conversation.handleServerEvent({
  type: "response.done",
  response: { usage: { input_tokens: 100, output_tokens: 30, input_token_details: { cached_tokens: 64 } } },
});
conversation.transcript.value.map((l) => `${l.who}: ${l.text}`).join(" / ");
=> character: Hello, Ada. / player: Hi Ama.

[conversation.responses.value.length, conversation.usage().inputTokens, conversation.usage().cachedTokens, conversation.characterSpeaking.value].join(" ");
=> 1 100 64 false
```

A server error is shown but does not end the session on its own; the
connection state decides that:

``` continue
conversation.handleServerEvent({ type: "error", error: { message: "conversation already has an active response" } });
[conversation.state.value, conversation.notice.value].join(" | ");
=> connected | conversation already has an active response
```

Mute disables the microphone track rather than dropping it, so unmuting is
instant:

``` continue
conversation.setMuted(true);
const whileMuted = r.stream.tracks[0].enabled;
conversation.setMuted(false);
[whileMuted, r.stream.tracks[0].enabled].join(" ");
=> false true
```

Turn-taking can change without a restart; it goes over the channel as a
session update:

``` continue
conversation.setTurnTaking("unhurried");
const update = peer.channel.sent.at(-1);
[update.type, update.session.audio.input.turn_detection.silence_duration_ms].join(" ");
=> session.update 1500
```

Elapsed time counts from when the channel opened:

``` continue
r.advance(65_000);
conversation.elapsedSeconds();
=> 65
```

Ending stops the track, closes the channel and the peer, and silences the
audio element. The second end is a no-op, and events arriving afterwards are
dropped:

``` continue
conversation.end("Ended.");
[conversation.state.value, conversation.endedBecause.value, conversation.inProgress, released(r)].join(" | ");
=> ended | Ended. | false | yyyyy

conversation.end("Again.");
conversation.handleServerEvent({ type: "response.output_audio_transcript.done", transcript: "Still here?" });
[conversation.endedBecause.value, conversation.transcript.value.length].join(" ");
=> Ended. 2
```

## Ended while still connecting

The player cancels while the secret is being minted. When the secret arrives
afterwards it is dropped: no peer connection is built, the microphone is
already released, and the state stays ended.

```ts
const mint = deferred<any>();
const r = rig({ mint });
void r.conversation.start();
await settle();
r.log.join(" ");
=> mic mint

r.conversation.end("Cancelled.");
mint.resolve({ secret: "ek_late", expiresAt: 0, model: "gpt-realtime-2.1-mini", voice: "marin" });
await settle();
await settle();
[r.conversation.state.value, r.log.join(" "), r.stream.tracks[0].stopped].join(" | ");
=> ended | mic mint | true
```

The same one step later, while the SDP exchange is in flight: the answer is
never applied and the peer is closed.

```ts
const call = deferred<string>();
const r = rig({ call });
void r.conversation.start();
await settle();
await settle();
await settle();
[r.conversation.state.value, r.log.join(" ")].join(" | ");
=> connecting | mic mint peer call:ek_test

r.conversation.end("Cancelled.");
call.resolve("v=0 answer");
await settle();
await settle();
[r.conversation.state.value, r.peer.remote === null, released(r)].join(" | ");
=> ended | true | yyyyy
```

And before the microphone has even been granted: the stream that arrives
after the cancel is stopped straight away.

```ts
const mic = deferred<any>();
const r = rig({ mic });
void r.conversation.start();
await settle();
r.conversation.end("Cancelled.");
const late = new FakeStream();
mic.resolve(late);
await settle();
await settle();
[r.conversation.state.value, late.tracks[0].stopped, r.log.join(" ")].join(" | ");
=> ended | true | mic
```

## Failures

A denied microphone is an error state with a sentence to show, nothing is
left held, and ordinary play can carry on:

```ts
const r = rig();
(r.conversation as any).deps.getMicrophone = async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); };
await r.conversation.start();
[r.conversation.state.value, r.conversation.error.value, r.conversation.inProgress, r.conversation.released].join(" | ");
=> error | Microphone access was denied. Allow the microphone and try again. | false | true
```

A secret that cannot be minted (a bad key, a missing model) is reported in the
server's words, and the microphone taken a moment earlier is released:

```ts
const r = rig();
(r.conversation as any).deps.mintSecret = async () => { throw new Error("OpenAI rejected that API key."); };
await r.conversation.start();
[r.conversation.state.value, r.conversation.error.value, r.stream.tracks[0].stopped].join(" | ");
=> error | OpenAI rejected that API key. | true
```

When the connection drops from the far side (the 60-minute limit, a network
change), the conversation is over and everything is released. Nothing
reconnects on its own; the panel offers to start again.

```ts
const r = rig();
await r.conversation.start();
r.peer.channel.open();
r.peer.setState("disconnected");
[r.conversation.state.value, r.conversation.endedBecause.value, released(r)].join(" | ");
=> ended | The connection ended. | yyyyy

const failed = rig();
await failed.conversation.start();
failed.peer.setState("failed");
[failed.conversation.state.value, failed.conversation.error.value].join(" | ");
=> error | The connection to OpenAI failed.
```

Error messages never carry a key, whatever threw them:

```ts
describeStartError(new Error("Bearer sk-abcdefghijklmnop was refused"));
=> Bearer sk-[redacted] was refused

describeStartError({ name: "NotFoundError" });
=> No microphone was found.
```
