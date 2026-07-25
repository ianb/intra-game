# Undo without losing the record

The update stream is the game's source of truth — and, once sessions live on a
server, its audit trail. So undo can't delete anything. Instead it appends an
event carrying a `rewind` count, and the superseded events are filtered out when
the world is folded.

The log stays append-only (a reviewer can still see what the model produced and
that the player took it back), while the game behaves as though those turns
never happened.

```ts setup
import { applyRewinds, lastTurnLength, isUserInput } from "../lib/game/rewind.js";
import type { StoryEventType } from "../lib/types.js";

// A player turn: the input event, then whatever it caused.
function input(text: string): StoryEventType {
  return {
    id: "PLAYER", roomId: "Intake", totalTime: 0, changes: {}, actions: [],
    llmParameters: { input: text },
  };
}
function reply(who: string): StoryEventType {
  return { id: who, roomId: "Intake", totalTime: 0, changes: {}, actions: [] };
}
function rewind(count: number): StoryEventType {
  return { id: "narrator", roomId: "Void", totalTime: 0, changes: {}, actions: [], rewind: count };
}

const ids = (events: StoryEventType[]) => events.map((e) => e.id).join(", ");
```

## Without a rewind, the live view is the whole log

```ts
const log = [input("hello"), reply("Ama")];
ids(applyRewinds(log));
=> PLAYER, Ama
```

## A rewind hides the events it supersedes — and itself

Undoing the last turn (the player's input plus the reply it caused) leaves only
what came before:

```ts
const log = [input("first"), reply("Ama"), input("second"), reply("Ama"), rewind(2)];
ids(applyRewinds(log));
=> PLAYER, Ama
```

The log itself is untouched — nothing was deleted, which is the point:

``` continue
log.length;
=> 5
```

## Rewinds compose

A rewind supersedes the preceding *live* events, so undoing twice walks back two
turns:

```ts
const log = [input("first"), reply("Ama"), input("second"), reply("Ama"), rewind(2), rewind(2)];
applyRewinds(log);
=> []
```

Rewinding more than exists is clamped rather than throwing:

```ts
applyRewinds([input("only"), rewind(99)]);
=> []
```

## Finding the turn to undo

`lastTurnLength` counts back to the most recent player input, so a turn's whole
cascade — the NPC replies, the schedule tick — is undone together:

```ts
lastTurnLength([input("first"), reply("Ama"), input("second"), reply("Ama"), reply("Marta")]);
=> 3
```

With nothing to undo it returns 0, which is how `Model.undo()` knows to do
nothing:

```ts
lastTurnLength([reply("Ama")]);
=> 0
```

Only events carrying player input count as the start of a turn:

```ts
[isUserInput(input("hi")), isUserInput(reply("Ama"))].join(" ");
=> true false
```
