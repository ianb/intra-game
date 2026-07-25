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
