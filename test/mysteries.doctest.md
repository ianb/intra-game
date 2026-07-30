# Mysteries arriving

A mystery has four states and until now could reach two of them. Ink and Echo
was revealed by an `if` inside Ama's `onStoryEvent` naming a room and a visit
count, so `available` and `solved` were declared, dedented on load, passed into
prompt assembly, and never once non-empty.

Triggers are declared on the mystery now. What this file checks is the part an
author gets wrong: when a trigger fires, when it doesn't, and that a mystery
never goes backwards.

```ts setup
import { Mystery } from "../lib/game/classes.js";
import { mysteryTriggers } from "../lib/game/mysteries.js";
import type { StoryEventType } from "../lib/types.js";

// A stand-in world: mysteryTriggers only reads entities, the player's room and
// the log, so this is the whole surface it touches.
function fakeWorld(mysteries: Mystery[], log: StoryEventType[] = []) {
  const world = {
    entities: { PLAYER: { inside: "Foyer" } } as Record<string, unknown>,
    rooms: {} as Record<string, { visits: number }>,
    getRoom(id: string) {
      return world.rooms[id];
    },
    getEntity(id: string) {
      return world.entities[id];
    },
    model: { liveUpdates: { value: log } },
  };
  for (const m of mysteries) world.entities[m.id] = m;
  return world;
}

const arriving = (room: string): StoryEventType =>
  ({
    id: "PLAYER",
    totalTime: 0,
    roomId: room,
    changes: { PLAYER: { before: { inside: "Foyer" }, after: { inside: room } } },
    actions: [],
  }) as StoryEventType;

const fire = (world: unknown, event: StoryEventType) =>
  mysteryTriggers(world as never, event);
```

## Walking into a room

```ts
const m = new Mystery({
  id: "poems",
  name: "who writes them",
  introduction: "Someone has been leaving poems.",
  triggers: [
    { enteredRoom: "Atrium", becomes: "revealed", announcedBy: "Ama" },
  ],
});
const world = fakeWorld([m]);
world.rooms.Atrium = { visits: 0 };
const events = fire(world, arriving("Atrium"));
JSON.stringify(events[0].changes.poems.after);
=> {"state":"revealed"}
```

Whoever announces it says the introduction, which is how an errand differs from
something the player noticed:

``` continue
`${events[0].id}: ${events[0].actions[0].text}`;
=> Ama: Someone has been leaving poems.
```

Nothing fires for a different room:

``` continue
fire(world, arriving("Cafe")).length;
=> 0
```

## Only the first visit

`visits` is bumped by the same event that moves the player, so a trigger keyed
on a room the player walks back into would otherwise fire every single time.

``` continue
const already = new Mystery({
  id: "again",
  name: "again",
  triggers: [{ enteredRoom: "Atrium", becomes: "revealed" }],
});
const revisited = fakeWorld([already]);
revisited.rooms.Atrium = { visits: 3 };
fire(revisited, arriving("Atrium")).length;
=> 0
```

## A mystery becoming available says nothing

`available` means the game will answer if asked, not that it has raised the
subject — so with nobody to announce it, the state changes silently.

```ts
const quiet = new Mystery({
  id: "quiet",
  name: "where are we",
  introduction: "This should not be read out.",
  triggers: [{ enteredRoom: "Atrium", becomes: "available" }],
});
const world = fakeWorld([quiet]);
world.rooms.Atrium = { visits: 0 };
const events = fire(world, arriving("Atrium"));
`${events.length} event, ${events[0].actions.length} actions`;
=> 1 event, 0 actions
```

## Never backwards

A trigger that would move a mystery back is ignored rather than being an error.
`{ solved: "x", becomes: "available" }` is a reasonable thing to write for a
mystery the player may well have already been given, and the author should not
have to reason about what order things happened in.

```ts
const ahead = new Mystery({
  id: "ahead",
  name: "ahead",
  state: "revealed",
  triggers: [{ enteredRoom: "Atrium", becomes: "available" }],
});
const world = fakeWorld([ahead]);
world.rooms.Atrium = { visits: 0 };
fire(world, arriving("Atrium")).length;
=> 0
```

Forwards from the same state still works:

``` continue
ahead.triggers = [{ enteredRoom: "Atrium", becomes: "solved" }];
JSON.stringify(fire(world, arriving("Atrium"))[0].changes.ahead.after);
=> {"state":"solved"}
```

## One mystery unlocking another

```ts
const first = new Mystery({ id: "first", name: "first", state: "solved" });
const second = new Mystery({
  id: "second",
  name: "second",
  triggers: [{ solved: "first", becomes: "available" }],
});
const world = fakeWorld([first, second]);
world.rooms.Atrium = { visits: 0 };
JSON.stringify(fire(world, arriving("Atrium"))[0].changes.second.after);
=> {"state":"available"}
```

Not while it is still unsolved:

``` continue
first.state = "revealed";
fire(fakeWorld([first, second]), arriving("Atrium")).length;
=> 0
```
