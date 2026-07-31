# The Star Citizen contest

The contest (lib/game/content/mysteries/star-citizen) is a counter and a
ceremony. Ama awards `PLAYER.civicPoints` for performed civic virtue; crossing
the threshold makes the player Star Citizen, unseals the Hallway's maintenance
door, and resolves the mystery — all in one engine-made event, so a model
narrates the win but cannot decide it.

```ts setup
import { entities } from "../lib/game/content/index.js";
import { Model } from "../lib/game/model.js";
import { CIVIC_POINTS_TO_WIN } from "../lib/game/content/mysteries/index.js";

const model = new Model(entities, { chat: async () => "" });
const world = model.world;
```

## Where the mysteries start

The contest is available from the first turn — Ama will score virtue whenever
she sees it — and lands on the task list only when someone tells the player
what the prize opens. The door mystery waits for the player to walk the
Hallway.

```ts
world.entities.Star_Citizen.state;
=> available
```

``` continue
world.entities.Sealed_Door.state;
=> veiled
```

## The door is data

The maintenance door is a restricted exit, present in the map from the start,
so `/nav` and the exits list show it and the restriction keeps everyone out.

```ts
const door = world
  .getRoom("Hallway")!
  .exits.find((exit) => exit.roomId === "Reflection_Chamber")!;
typeof door.restriction;
=> string
```

The corridor side is not restricted — being let in never means being locked in:

``` continue
world
  .getRoom("Reflection_Chamber")!
  .exits.some((exit) => exit.roomId === "Hallway");
=> true
```

## Meters reach prompts

Hints are static strings, so an instruction like "her behavior is keyed to
PLAYER.civicPoints" needs the current value injected — otherwise the model only
knows the count while its own `<set>` events are still inside the sliding
history window. A mystery declares `meters`, and every character it briefs gets
the values appended to their hint block.

```ts
world.entities.PLAYER.civicPoints = 3;
const prompt = world.entities.Marta.assemblePrompt({});
const system = String(prompt.messages[0]!.content);
system.includes("Current values: PLAYER.civicPoints = 3");
=> true
```

## The ceremony

The mystery itself watches for the crossing. One event carries the whole
transition: the title, the unsealed door, and the mystery resolved.

```ts
const crossing = {
  id: "Ama",
  totalTime: 0,
  roomId: "Hollow_Atrium",
  changes: {
    PLAYER: {
      before: { civicPoints: CIVIC_POINTS_TO_WIN - 1 },
      after: { civicPoints: CIVIC_POINTS_TO_WIN },
    },
  },
  actions: [],
};
const requests = world.entities.Star_Citizen.onStoryEvent(crossing);
requests.length;
=> 2
```

``` continue
const ceremony = requests[0]!;
ceremony.changes.PLAYER.after.starCitizen;
=> true
```

``` continue
ceremony.changes.Star_Citizen.after.state;
=> solved
```

The door's restriction is cleared in the same event, on a cloned exits list —
the live room is untouched until the event folds:

``` continue
const exits = ceremony.changes.Hallway.after.exits;
exits.find((exit) => exit.roomId === "Reflection_Chamber").restriction;
=> undefined
```

``` continue
typeof world
  .getRoom("Hallway")!
  .exits.find((exit) => exit.roomId === "Reflection_Chamber")!.restriction;
=> string
```

And the second request asks Ama for the ceremony scene:

``` continue
requests[1]!.parameters.prompt;
=> ceremony
```

## It fires once

A player who is already Star Citizen crossing the number again — an undo, a
replayed log, a generous model — does not get a second ceremony:

``` continue
world.entities.PLAYER.starCitizen = true;
world.entities.Star_Citizen.onStoryEvent(crossing).length;
=> 0
```

Points alone, without crossing the threshold, do nothing:

``` continue
world.entities.PLAYER.starCitizen = false;
const oneMore = {
  ...crossing,
  changes: {
    PLAYER: { before: { civicPoints: 1 }, after: { civicPoints: 2 } },
  },
};
world.entities.Star_Citizen.onStoryEvent(oneMore).length;
=> 0
```

## Available is not a task

The sealed door mystery becomes `available` the first time the player walks
the Hallway, and available means the game will answer if asked — not that the
game raises the subject. Only `revealed` and `solved` reach the task list.

``` continue
world.applyStoryEvent({
  id: "narrator",
  totalTime: 0,
  roomId: "Hallway",
  changes: {
    Sealed_Door: { before: { state: "veiled" }, after: { state: "available" } },
  },
  actions: [],
});
world.todos.length;
=> 0
```

``` continue
world.applyStoryEvent({
  id: "narrator",
  totalTime: 0,
  roomId: "Hallway",
  changes: {
    Sealed_Door: {
      before: { state: "available" },
      after: { state: "revealed" },
    },
  },
  actions: [],
});
world.todos.map((todo) => todo.title).join("");
=> What is behind the sealed door in the Hallway?
```
