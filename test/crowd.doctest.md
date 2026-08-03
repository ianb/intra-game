# Crowd control: who gets to respond to a turn

Walk into the café at lunch and everyone is on an attentive schedule, so every
character in the room reacted to every player turn — six overlapping
monologues. The reaction gate stays per-character; `capReactions` is the one
place with the global view.

The rules: whoever the player is interacting with is guaranteed a turn
(priority 3 — spoken to directly, or the player's current interlocutor);
everyone else competes for the remaining slots, higher priority first, with
ties going to whoever has acted least recently, so the bystander slot rotates
through the crowd.

```ts setup
import { capReactions, REACTION_CAP } from "../lib/game/crowd.js";

function reaction(id: string, reactionPriority: number) {
  return { type: "promptRequest" as const, id, parameters: { reactionPriority } };
}
function scripted(id: string) {
  return { type: "promptRequest" as const, id, parameters: {} };
}
function acted(id: string) {
  return { id, totalTime: 0, roomId: "Joyous_Cafe", changes: {}, actions: [] };
}
```

## Under the cap, nothing happens

```ts
capReactions([reaction("June", 3), reaction("Doug", 1)], []).length;
=> 2
```

## The lunch crowd is capped

Six attentive bystanders become the cap's worth, and the conversation partner
always survives:

```ts
const lunch = [
  reaction("June", 3),
  reaction("Doug", 1),
  reaction("Lana", 1),
  reaction("Harold", 0),
  reaction("Greg", 0),
  reaction("Milton", 1),
];
const kept = capReactions(lunch, []);
[kept.length, kept.some((r) => r.id === "June")].join(" ");
=> 3 true
```

## Interacting always beats bystanding

Everyone the player is directly engaged with keeps a turn even when that
exceeds the bystander budget — the guarantee is not a ranking:

``` continue
capReactions(
  [
    reaction("June", 3),
    reaction("Doug", 3),
    reaction("Marta", 3),
    reaction("Lana", 3),
    reaction("Harold", 0),
  ],
  [],
)
  .map((r) => r.id)
  .join(" ");
=> June Doug Marta Lana
```

## The bystander slot rotates

On equal priority, whoever has acted least recently wins — Harold spoke last
turn, so Greg (silent all game) gets the slot:

```ts
capReactions(
  [
    reaction("June", 3),
    reaction("Doug", 3),
    reaction("Harold", 0),
    reaction("Greg", 0),
  ],
  [acted("Harold")],
  3,
)
  .map((r) => r.id)
  .join(" ");
=> June Doug Greg
```

## Scripted requests pass through

Mystery triggers, ceremonies and wakeups carry no priority and are never
capped, whatever else is happening:

```ts
capReactions(
  [
    scripted("Ama"),
    reaction("June", 1),
    reaction("Doug", 1),
    reaction("Harold", 1),
    reaction("Greg", 1),
  ],
  [],
  3,
).length;
=> 4
```
