# /go: movement without interpretation

A map click knows its destination, so it sends `/go <roomId>` and the engine
runs the full goto path directly — sealed doors refuse, restricted exits still
go to adjudication, visits count, the arrival description is produced. Only
the input-interpretation call is skipped, because a click has nothing to
interpret.

The backends below prove the model-call budget: a throwing backend shows the
paths that need no model at all, and counting backends show exactly which
calls remain.

```ts setup
import { entities } from "../lib/game/content/index.js";
import { Model } from "../lib/game/model.js";
```

## Moving to an empty room costs zero model calls

```ts
const silent = new Model(entities, {
  chat: async () => {
    throw new Error("no model call expected");
  },
});
silent.world.entities.PLAYER.launched = true;
silent.world.entities.PLAYER.inside = "Hollow_Atrium";
await silent.sendText("/go Hallway");
silent.world.entities.PLAYER.inside;
=> Hallway
```

## The sealed door refuses, also for free

``` continue
await silent.sendText("/go Reflection_Chamber");
silent.world.entities.PLAYER.inside;
=> Hallway
```

``` continue
const refusal = silent.updates.value.at(-1)!;
refusal.actions.some(
  (action) => "text" in action && action.text.includes("sealed"),
);
=> true
```

## An occupied room costs exactly the people prose

The one model call left on this path is `formatPeopleDescription`, the flash
call that writes the "You see..." prose — kept deliberately, because the
descriptions are fun.

```ts
const titles = [];
const counting = new Model(entities, {
  chat: async (request) => {
    titles.push(request.meta.title);
    return "Marta is here, posing.";
  },
});
counting.world.entities.PLAYER.launched = true;
counting.world.entities.PLAYER.inside = "Hallway";
await counting.sendText("/go Hollow_Atrium");
[counting.world.entities.PLAYER.inside, titles.join(",")].join(" | ");
=> Hollow_Atrium | describe people
```

## Restricted exits still get adjudicated

A quarters door has a prose restriction, and that judgment still happens — one
"player move" call, and a refusal leaves the player where they were:

```ts
const guarded = [];
const restricted = new Model(entities, {
  chat: async (request) => {
    guarded.push(request.meta.title);
    return `<description minutes="2">The door does not budge.</description>`;
  },
});
restricted.world.entities.PLAYER.launched = true;
restricted.world.entities.PLAYER.inside = "Hallway";
await restricted.sendText("/go Quarters_Marta");
[restricted.world.entities.PLAYER.inside, guarded.join(",")].join(" | ");
=> Hallway | player move
```
