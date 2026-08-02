# A character's state of mind

`<mind>` is a character's private note to themselves — about one sentence of
mood, reaction, or intention, or nothing at all. Unlike `<context>`, which is
planning output and evaporates, a mind lands in the event log and the
character's own history shows it back to them on later turns; that is what
lets a mood survive past the turn that caused it. Named mind rather than
thought because "thinking" already means the model's own reasoning.

The property that matters is privacy, in both directions: the owner always
sees it, nobody else ever does — not other characters, and not the player.

```ts setup
import { entities } from "../lib/game/content/index.js";
import { Model } from "../lib/game/model.js";
import { applyTag } from "../lib/game/tags.js";
import { updateToHistory } from "../lib/game/history.js";
import { parseTags } from "../lib/parsetags.js";

const model = new Model(entities, { chat: async () => "" });
const world = model.world;

function eventFrom(entityId: string, response: string) {
  const event = {
    id: entityId,
    totalTime: 0,
    roomId: "Hollow_Atrium",
    changes: {},
    actions: [],
  };
  for (const tag of parseTags(response)) {
    applyTag(tag, event, { world, entityId, roomId: "Hollow_Atrium" });
  }
  return event;
}
```

## It is an action like any other

```ts
const event = eventFrom(
  "Marta",
  `<dialog character="Marta">Lovely to meet a new citizen.</dialog>` +
    `<mind>A challenger. Smile wider.</mind>`,
);
event.actions.map((action) => action.type).join(" ");
=> dialog mind
```

## The owner sees it in their history

``` continue
const marta = updateToHistory(world.entities.Marta, event, {})[0]!.content;
[marta.includes("Lovely to meet"), marta.includes("A challenger")].join(" ");
=> true true
```

## Nobody else does

Someone standing in the same room gets the dialog and not the mind:

``` continue
const frida = updateToHistory(world.entities.Frida, event, {})[0]!.content;
[frida.includes("Lovely to meet"), frida.includes("A challenger")].join(" ");
=> true false
```

And the player's prompts are built through the same renderer, so the player's
model never sees it either:

``` continue
const player = updateToHistory(world.entities.PLAYER, event, {})[0]!.content;
player.includes("A challenger");
=> false
```

## A mind belongs to whoever had it

A `character=` attribute is ignored: the note is attributed to the entity whose
response it was, so a model cannot put a thought in someone else's head.

```ts
const forged = eventFrom("Marta", `<mind character="Frida">I am Frida.</mind>`);
forged.actions[0]!.id;
=> Marta
```

## Empty minds are dropped

```ts
eventFrom("Marta", `<mind>  </mind>`).actions.length;
=> 0
```
