# Driving the engine headless

The game engine has no dependency on React or the browser: you can construct a
`Model`, hand it a fake LLM backend, and drive it from plain Node. That is what
makes automated playtesting possible — a test (or an agent) scripts the LLM's
responses and asserts on the resulting story stream, with no DOM in sight.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/gameobjs.js";
import type { ChatType } from "../lib/types.js";

// A scripted LLM backend: it routes on the prompt's title, so the order of
// engine-internal calls doesn't matter. Anything unscripted returns "" (which
// parses to no actions), keeping incidental NPC/Ama chatter benign.
function scriptedChat(script: Record<string, string>) {
  return async (prompt: ChatType) => script[prompt.meta.title] ?? "";
}

// The engine reacts to events by spawning more (awaited) work; drain the queue
// so a turn is fully resolved before we assert, and nothing leaks past the test.
async function settle(model: Model) {
  while (model.runningSignal.value) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// The most recent description text in the story stream, or null.
function lastDescription(model: Model): string | null {
  const updates = model.updates.value;
  for (let i = updates.length - 1; i >= 0; i--) {
    for (const action of updates[i]!.actions) {
      if (action.type === "description") {
        return action.text;
      }
    }
  }
  return null;
}
```

A fresh model starts the player in the Intake room, with an empty stream:

```ts
const model = new Model(entities, { chat: scriptedChat({}) });
model.world.entities.player.inside;
=> Intake

model.updates.value.length;
=> 0
```

## A scripted turn

`sendText` runs the player's input through the LLM. Here the fake interprets
"look around" as an examine, and the examine step produces the room
description — two engine-internal LLM calls, both satisfied by the script:

```ts
const model = new Model(entities, {
  chat: scriptedChat({
    "player input": "<examine>look around</examine>",
    "player examine":
      "<description>A small, sterile medical room with a single cot.</description>",
  }),
});
await model.sendText("look around");
await settle(model);
lastDescription(model);
=> A small, sterile medical room with a single cot.
```

## Append-only stream, with tracked positions

Nothing is mutated in place: a turn only appends to the update stream, and the
world (including who is in which room) is a fold over that stream. So after the
turn the stream has grown, and the player's position is still recoverable from
it:

```ts
const model = new Model(entities, {
  chat: scriptedChat({ "player input": "<examine>look</examine>" }),
});
await model.sendText("look");
await settle(model);
model.updates.value.length > 0;
=> true

const positions = model.updatesWithPositions.value.at(-1)!.positions;
positions.get("player");
=> Intake
```
