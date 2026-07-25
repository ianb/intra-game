# The LLM tag protocol

The model doesn't call tools — it replies with tag-shaped text, and `tags.ts`
turns each tag into a change or an action on the story event being built. This
is the contract between "what the model wrote" and "what happened in the game",
so it's worth pinning precisely.

`applyTag` is synchronous and takes no Model or LLM, so the whole protocol can be
exercised directly.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { applyTag } from "../lib/game/tags.js";
import { parseTags } from "../lib/parsetags.js";
import type { StoryEventType } from "../lib/types.js";

const world = new Model(entities, { chat: async () => "" }).world;
const ctx = { world, entityId: "Ama", roomId: "Intake" };

// Apply every tag in a snippet of model output to a fresh story event.
function apply(response: string, extra: Record<string, unknown> = {}) {
  const event: StoryEventType = {
    id: "Ama", roomId: "Intake", totalTime: 0, changes: {}, actions: [],
  };
  const unhandled: string[] = [];
  for (const tag of parseTags(response)) {
    if (!applyTag(tag, event, { ...ctx, ...extra })) unhandled.push(tag.type);
  }
  return { event, unhandled };
}
```

## Dialog

`<dialog>` becomes a dialog action. The speaker defaults to the responding
entity, and `to=` is resolved to an entity id:

```ts
const { event } = apply(`<dialog character="Ama" to="PLAYER">Welcome home.</dialog>`);
JSON.stringify(event.actions[0]);
=> {"type":"dialog","id":"Ama","toId":"PLAYER","text":"Welcome home."}
```

Speaking costs time, so conversation advances the clock:

``` continue
event.totalTime > 0;
=> true
```

Empty dialog is dropped rather than producing a silent turn:

```ts
apply(`<dialog character="Ama">   </dialog>`).event.actions.length;
=> 0
```

## Descriptions

`<description>` carries an optional duration, which is added to the event's
elapsed time:

```ts
const { event } = apply(`<description minutes="15">You tidy the room.</description>`);
[event.actions.length, event.totalTime].join(" / ");
=> 1 / 15
```

## Writing game state with `<set>`

`<set attr="entity.field">` records a before/after change. The value is coerced
to the field's existing type — `Ama.sharedSelf` is a boolean, so the text "true"
becomes the boolean `true`:

```ts
const { event } = apply(`<set attr="Ama.sharedSelf">true</set>`);
JSON.stringify(event.changes.Ama);
=> {"before":{"sharedSelf":false},"after":{"sharedSelf":true}}
```

The guard from `coerce.ts` applies here, so a non-answer never lands:

```ts
JSON.stringify(apply(`<set attr="PLAYER.name">unknown</set>`).event.changes);
=> {}
```

Malformed tags are skipped, not thrown — one bad tag can't lose the turn:

```ts
const bad = `<set>no attr</set><set attr="nodot">x</set><set attr="Nobody.name">x</set>`;
JSON.stringify(apply(bad).event.changes);
=> {}
```

## Mysteries, triggers and scheduling

Resolving a mystery both records the state change and narrates it:

```ts
const { event } = apply(`<resolveMystery id="Ink_And_Echo">The ink was never real.</resolveMystery>`);
[event.changes.Ink_And_Echo!.after.state, event.actions[0]!.type].join(" / ");
=> solved / description
```

`<trigger>` marks another character to act next, and `<suggestion>` /
`<deferSchedule>` set their fields:

```ts
const { event } = apply(
  `<trigger character="Marta">Marta overhears</trigger><suggestion>say hello</suggestion><deferSchedule></deferSchedule>`
);
[JSON.stringify(event.triggers), event.suggestions, event.deferSchedule].join(" / ");
=> {"Marta":"Marta overhears"} / say hello / true
```

## Unknown tags fall through

Tags outside the base protocol return false, which is how `PlayerClass` gets to
handle its own `<goto>` / `<examine>` / `<action>` via `processTag`:

```ts
apply(`<goto>Foyer</goto><examine>the door</examine>`).unhandled.join(", ");
=> goto, examine
```
