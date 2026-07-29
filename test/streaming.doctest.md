# Playing a turn as it arrives

When a streaming backend is configured, narrative text is shown while it's still
arriving instead of appearing all at once when the turn finishes. The important
property is that this changes *timing only*: the same authoritative event lands
in the log either way.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { effect } from "@preact/signals-core";
import type { ChatType } from "../lib/types.js";

// A backend that dribbles a canned response out in small pieces.
function dribble(response: string, size = 6) {
  return async (_prompt: ChatType, onDelta: (d: string) => void) => {
    for (let i = 0; i < response.length; i += size) {
      onDelta(response.slice(i, i + size));
      await new Promise((r) => setTimeout(r, 0));
    }
    return response;
  };
}

async function settle(model: Model) {
  while (model.runningSignal.value) await new Promise((r) => setTimeout(r, 10));
}

const AMA_REPLY = `<dialog character="Ama" to="PLAYER">Welcome home, dear one.</dialog>`;
```

## Text appears progressively

Watching `model.streaming` during a turn shows the dialog filling in. The
snapshots are prefixes of the final line, which is what makes a typewriter
effect possible:

```ts
const model = new Model(entities, { chatStream: dribble(AMA_REPLY) });
const seen: string[] = [];
const stop = effect(() => {
  const s = model.streaming.value;
  if (s) seen.push(s.tag.content);
});
await model.sendText("hello");
await settle(model);
stop();

seen.length > 2;
=> true

seen.every((s, i) => i === 0 || s.startsWith(seen[i - 1]!));
=> true
```

The last thing seen is the complete line:

``` continue
seen.at(-1);
=> Welcome home, dear one.
```

## Nothing is left on screen afterwards

`streaming` returns to null once the turn completes, so provisional text never
lingers next to the committed log:

``` continue
model.streaming.value;
=> null
```

## The committed result is identical either way

The same response through a non-streaming backend produces the same story
event — streaming is display timing, not a second source of truth:

```ts
const streamed = new Model(entities, { chatStream: dribble(AMA_REPLY) });
await streamed.sendText("hello");
await settle(streamed);

const plain = new Model(entities, { chat: async () => AMA_REPLY });
await plain.sendText("hello");
await settle(plain);

const dialogOf = (m: Model) =>
  m.liveUpdates.value.flatMap((u) => u.actions).filter((a) => a.type === "dialog");

JSON.stringify(dialogOf(streamed)) === JSON.stringify(dialogOf(plain));
=> true
```

And the dialog really did land in the log:

``` continue
dialogOf(streamed).length > 0;
=> true
```

## A streaming backend answers the non-streaming calls too

Almost every prompt goes through `executePrompt`, which uses `chatStream` when
there is one. One doesn't: `formatPeopleDescription` calls `model.chat`
directly, because its answer is prose written into a room description rather
than a turn to show arriving.

That made `chat` reachable on a Model configured with only a stream — the
server's configuration — where it fell through to the browser's OpenRouter
client and asked localStorage for a key. A game played fine until the player
walked into a room with somebody in it, and then the server reported "No
OpenRouter API key found. Please connect to OpenRouter first."

So a stream backs both, and the deltas are dropped:

```ts
const calls: string[] = [];
const model = new Model(entities, {
  chatStream: async (prompt) => {
    calls.push(String(prompt.meta.title));
    return "Two citizens ignore you with great dedication.";
  },
});
await model.chat({ meta: { title: "describe people" }, messages: [] });
calls.join(" ");
=> describe people
```

It is still `chat`'s answer that comes back, whole:

``` continue
const answer = await model.chat({ meta: { title: "describe people" }, messages: [] });
answer;
=> Two citizens ignore you with great dedication.
```

An explicit `chat` still wins, so a test can drive the two separately:

``` continue
const both = new Model(entities, {
  chat: async () => "from chat",
  chatStream: async () => "from stream",
});
await both.chat({ meta: { title: "x" }, messages: [] });
=> from chat
```
