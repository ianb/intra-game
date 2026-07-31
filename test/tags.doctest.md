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

## Telling the model what it got wrong

A `<set>` naming an attribute that doesn't exist is the most common protocol
failure across every model measured — `PLAYER.intakeStep`, `Ama.askingProfession`,
field names invented on the spot. The engine warned and moved on, so the game
recorded less than the story said had happened, silently.

A caller can now ask what wouldn't apply, in words meant for the model rather
than for a log. The entity re-prompts once with its own answer and this list;
see `executePrompt`.

```ts setup
const complain = (markup) => {
  const complaints = [];
  const event = { id: "Ama", roomId: "Intake", totalTime: 0, changes: {}, actions: [] };
  for (const tag of parseTags(markup)) {
    applyTag(tag, event, { world, entityId: "Ama", roomId: "Intake", complaints });
  }
  return complaints;
};
```

```ts
complain(`<set attr="PLAYER.intakeStep">done</set>`).join("");
=> <set attr="PLAYER.intakeStep"> — PLAYER has no attribute "intakeStep".
```

A real attribute given a real value says nothing:

``` continue
complain(`<set attr="PLAYER.name">Pat Quill</set>`).length;
=> 0
```

Collecting is opt-in — a caller that passes no array gets the old behaviour,
warnings and all:

``` continue
const event = { id: "Ama", roomId: "Intake", totalTime: 0, changes: {}, actions: [] };
const [tag] = parseTags(`<set attr="PLAYER.intakeStep">done</set>`);
applyTag(tag, event, { world, entityId: "Ama", roomId: "Intake" });
=> true
```

## Counting up

`<set>` on a number normally replaces it. `+N` adds instead, which is what a
counter needs: the alternative is telling the model the current value and
trusting it to add one, and when that goes wrong it goes wrong silently — a
count that keeps being re-set to 1 never reaches whatever it was counting
towards. The Archivist's `angst` is counted this way.

```ts
world.entities.Archivist.angst = 2;
const { event } = apply(`<set attr="Archivist.angst">+1</set>`);
String(event.changes.Archivist.after.angst);
=> 3
```

A bare number still replaces, and `-2` stays a value rather than a subtraction —
it is far likelier to mean "set this to minus two":

``` continue
world.entities.Archivist.angst = 2;
String(apply(`<set attr="Archivist.angst">7</set>`).event.changes.Archivist.after.angst);
=> 7
```

## Pronouns, however they were written

Only three pronoun sets work downstream, so `<set attr="PLAYER.pronouns">` was
validated against exactly `he/him`, `she/her` and `they/them`. A model asked to
record what a player just said writes what the player said, which is often
`he/him/his`, or just `he`. Those were rejected, so a player who answered the
question perfectly well stayed `they/them`, and the model got a complaint about
a tag it had every reason to think was right.

```ts
const { event } = apply(`<set attr="PLAYER.pronouns">He/Him/His</set>`);
String(event.changes.PLAYER.after.pronouns);
=> he/him
```

``` continue
["he", "She / Her", "they/them/theirs", "them"]
  .map((p) => apply(`<set attr="PLAYER.pronouns">${p}</set>`))
  .map((r) => String(r.event.changes.PLAYER?.after?.pronouns))
  .join(" ");
=> he/him she/her they/them they/them
```

Something that isn't a pronoun set is still refused rather than guessed at:

``` continue
const bad = apply(`<set attr="PLAYER.pronouns">whatever you like</set>`);
String(bad.event.changes.PLAYER?.after?.pronouns);
=> undefined
```
