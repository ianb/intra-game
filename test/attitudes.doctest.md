# Attitudes: how a character feels about people

Each person carries `attitudes`, a record keyed by entity id of how they
currently feel about specific people — written by the character itself with
`<attitude toward="...">`, shown only in that character's own prompt, and
persisted through the fold.

Sparse on purpose. No key means no particular feeling, and that is the normal
state: a character with no feelings carries no feelings text in their prompt at
all, rather than a list of "neutral" entries.

```ts setup
import { entities } from "../lib/game/content/index.js";
import { Model } from "../lib/game/model.js";
import { applyTag } from "../lib/game/tags.js";
import { parseTags } from "../lib/parsetags.js";

const model = new Model(entities, { chat: async () => "" });
const world = model.world;

function eventFrom(entityId: string, response: string, complaints = []) {
  const event = {
    id: entityId,
    totalTime: 0,
    roomId: "Hollow_Atrium",
    changes: {},
    actions: [],
  };
  for (const tag of parseTags(response)) {
    applyTag(tag, event, {
      world,
      entityId,
      roomId: "Hollow_Atrium",
      complaints,
    });
  }
  return event;
}
```

## Blank is the default

```ts
Object.keys(world.entities.Marta.attitudes).length;
=> 0
```

``` continue
String(world.entities.Marta.assemblePrompt({}).messages[0]!.content).includes(
  "private feelings",
);
=> false
```

## A feeling is a change, and it folds

```ts
const event = eventFrom(
  "Marta",
  `<attitude toward="PLAYER">Wary of them since the standings changed.</attitude>`,
);
world.applyStoryEvent(event);
world.entities.Marta.attitudes.PLAYER;
=> Wary of them since the standings changed.
```

The character's own prompt now carries it:

``` continue
String(world.entities.Marta.assemblePrompt({}).messages[0]!.content).includes(
  "Wary of them since the standings changed.",
);
=> true
```

Nobody else's does — the feeling is injected into the owner's prompt, not the
history, so there is nothing for another character to see:

``` continue
String(world.entities.Frida.assemblePrompt({}).messages[0]!.content).includes(
  "Wary of them",
);
=> false
```

## Feelings merge per person

A new feeling about someone else leaves the first one alone:

``` continue
world.applyStoryEvent(
  eventFrom("Marta", `<attitude toward="Gloria">Grateful for the warning.</attitude>`),
);
[world.entities.Marta.attitudes.PLAYER, world.entities.Marta.attitudes.Gloria]
  .filter(Boolean).length;
=> 2
```

## Faded is blank, not neutral

Empty content clears the feeling — the key is removed rather than set to
"neutral":

``` continue
world.applyStoryEvent(
  eventFrom("Marta", `<attitude toward="Gloria"></attitude>`),
);
"Gloria" in world.entities.Marta.attitudes;
=> false
```

And clearing a feeling that was never there is a no-op, not an event:

``` continue
Object.keys(eventFrom("Marta", `<attitude toward="Henry"></attitude>`).changes)
  .length;
=> 0
```

## The target must be a person

A made-up id is a complaint — the fixable-error channel that gets handed back
to the model — not a silent write:

```ts
const complaints = [];
const bad = eventFrom(
  "Marta",
  `<attitude toward="Vending_Machine">Suspicious.</attitude>`,
  complaints,
);
[Object.keys(bad.changes).length, complaints.length].join(" ");
=> 0 1
```
