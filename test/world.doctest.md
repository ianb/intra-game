# The world graph

`World` is the queryable view over the game's entities: it resolves names to
ids, finds which room something is in (following nesting), lists a room's
occupants, and answers reachability. These are the primitives the engine and the
prompts lean on constantly.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { pathTo } from "../lib/game/pathto.js";

// A fresh headless world (fake LLM; we never call it here).
const world = new Model(entities, { chat: async () => "" }).world;
```

## Resolving names to ids

`makeId` accepts an id or a human name (case- and spacing-insensitive) and
returns the canonical id, or null if nothing matches:

```ts
world.makeId("Ama");
=> Ama

world.makeId("The Hollow Atrium");
=> Hollow_Atrium

world.makeId("nonesuch");
=> null
```

## Which room am I in?

`entityRoom` walks the containment chain until it reaches a room. The player
starts in Intake — and Ama, who is nested _inside_ the player, resolves to the
same room:

```ts
world.entityRoom("PLAYER").id;
=> Intake

world.entityRoom("Ama").id;
=> Intake
```

`isInside` reports containment directly, including that nesting:

```ts
[world.isInside("PLAYER", "Intake"), world.isInside("Ama", "PLAYER")].join(" ");
=> true true
```

## Occupants and reachability

`entitiesInRoom` lists what's in a room:

```ts
world
  .entitiesInRoom("Tranquil_Pool")
  .map((e) => e.id)
  .join(", ");
=> June, Doug
```

`pathTo` is a breadth-first shortest path over room exits, returning the ids to
walk through (excluding the start). Adjacent rooms are one hop:

```ts
pathTo(world, "Hollow_Atrium", "Activity_Hub");
=> [
  "Activity_Hub"
]
```

Farther rooms return the full route:

```ts
pathTo(world, "Foyer", "Archive_Console");
=> [
  "Hollow_Atrium",
  "Archive_Lounge",
  "Archive_Console"
]
```
