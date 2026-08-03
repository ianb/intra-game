# Meters: counted feelings, judged one step at a time

Free-text attitudes are color; meters are measurement. A character declares a
small number of emotional dials in their own content block — range, what
raises one, what lowers one, and register text for what each level means — and
the value lives as a plain numeric field, so all the existing machinery
(signed `<set>` deltas, `Mystery.meters` injection, `attrSet` triggers)
operates on it unchanged.

The design split, same as `Archivist.angst`: the model judges the moment
("did this turn annoy him? +1") and never the level. The level is engine
arithmetic, clamped to the declared range, and the register text tells the
model how to play the number it is at.

```ts setup
import { entities } from "../lib/game/content/index.js";
import { Model } from "../lib/game/model.js";
import { Mystery, Person } from "../lib/game/classes.js";
import { applyTag } from "../lib/game/tags.js";
import { entitiesById } from "../lib/game/dynamic.js";
import { meterMoves } from "../app/metermoves.js";
import { mysteryTriggers } from "../lib/game/mysteries.js";
import { parseTags } from "../lib/parsetags.js";

const model = new Model(entities, { chat: async () => "" });
const world = model.world;

function setFrom(entityId: string, response: string) {
  const event = {
    id: entityId,
    totalTime: 0,
    roomId: "Feedback_Booth",
    changes: {},
    actions: [],
  };
  for (const tag of parseTags(response)) {
    applyTag(tag, event, { world, entityId, roomId: "Feedback_Booth" });
  }
  world.applyStoryEvent(event);
  return event;
}

function threw(fn: () => unknown): string {
  try {
    fn();
    return "";
  } catch (e) {
    return String(e);
  }
}
```

## Declared on the character, valued as a field

```ts
world.entities.Milton.annoyance;
=> 0
```

``` continue
world.entities.Milton.statSpecs.annoyance.max;
=> 6
```

## Signed deltas, clamped to the range

```ts
setFrom("Milton", `<set attr="Milton.annoyance">+1</set>`);
setFrom("Milton", `<set attr="Milton.annoyance">+1</set>`);
world.entities.Milton.annoyance;
=> 2
```

A step down works — the design reason for allowing `-N` at all is pacing, so
apologies have somewhere to land:

``` continue
setFrom("Milton", `<set attr="Milton.annoyance">-1</set>`);
world.entities.Milton.annoyance;
=> 1
```

The floor is the declared minimum, not a crash into negative annoyance:

``` continue
setFrom("Milton", `<set attr="Milton.annoyance">-1</set>`);
setFrom("Milton", `<set attr="Milton.annoyance">-1</set>`);
world.entities.Milton.annoyance;
=> 0
```

And the ceiling is the declared maximum, on absolute sets as well as deltas:

``` continue
setFrom("Milton", `<set attr="Milton.annoyance">9</set>`);
world.entities.Milton.annoyance;
=> 6
```

## Negative ranges are allowed

A single like/dislike axis is a meter whose minimum is negative:

```ts
const stranger = new Person({
  id: "Stranger",
  name: "Stranger",
  stats: { regard: { min: -3, max: 3 } },
});
[stranger.regard, stranger.statSpecs.regard.min].join(" ");
=> 0 -3
```

A stat cannot shadow a real field:

``` continue
threw(() =>
  new Person({ id: "Broken", name: "Broken", stats: { name: { max: 3 } } }),
).includes("collides");
=> true
```

## The owner's prompt carries the dial and the registers

```ts
const prompt = String(
  world.entities.Milton.assemblePrompt({}).messages[0]!.content,
);
[
  prompt.includes("annoyance = 6 (range 0 to 6)"),
  prompt.includes("Raise it (+1) when:"),
  prompt.includes("The formal complaint"),
].join(" ");
=> true true true
```

Characters without meters carry nothing:

``` continue
String(world.entities.Frida.assemblePrompt({}).messages[0]!.content).includes(
  "meters",
);
=> false
```

## Thresholds are triggers

`reaches` fires a mystery trigger when the value crosses from below — the
deterministic consequence layer, same machinery as every other trigger:

```ts
const boilOver = new Mystery({
  id: "Boil_Over",
  name: "What did Milton just file?",
  triggers: [
    { attrSet: "Milton.annoyance", reaches: 6, becomes: "revealed" },
  ],
});
boilOver.world = world;
entitiesById(world.entities).Boil_Over = boilOver;

const crossing = {
  id: "Milton",
  totalTime: 0,
  roomId: "Feedback_Booth",
  changes: {
    Milton: { before: { annoyance: 5 }, after: { annoyance: 6 } },
  },
  actions: [],
};
mysteryTriggers(world, crossing).length;
=> 1
```

Sitting at the threshold does not re-fire — only the crossing:

``` continue
const still = {
  ...crossing,
  changes: { Milton: { before: { annoyance: 6 }, after: { annoyance: 6 } } },
};
mysteryTriggers(world, still).length;
=> 0
```

## The transcript marks the move

The player-facing indicator is mechanical, because the in-fiction beat
saturates on exactly the characters that carry meters: an annoyed Milton and
a baseline Milton both complain. `meterMoves` finds declared-meter changes in
an event; the chat log renders them as "Milton annoyance ▲" — direction, not
value.

```ts
const bump = {
  id: "Milton",
  totalTime: 0,
  roomId: "Feedback_Booth",
  changes: {
    Milton: { before: { annoyance: 1 }, after: { annoyance: 2 } },
  },
  actions: [],
};
const moves = meterMoves(bump, world);
[moves[0]!.name, moves[0]!.meter, moves[0]!.delta].join(" ");
=> Milton annoyance 1
```

Undeclared numbers are not the player's business — `civicPoints` has Ama's
intercom announcements, and internal counters stay internal:

``` continue
meterMoves(
  {
    ...bump,
    changes: {
      PLAYER: { before: { civicPoints: 1 }, after: { civicPoints: 2 } },
    },
  },
  world,
).length;
=> 0
```

## An action done to someone wakes them

A resolved player action naming a character triggers their reaction, the same
as dialog directed at them. Without this, an action's target could never
answer it — and the action adjudicator used to fill that silence by
roleplaying the target itself.

```ts
world.entities.Milton.inside = "Feedback_Booth";
world.entities.PLAYER.inside = "Feedback_Booth";
const reactions = world.entities.Milton.onStoryEvent({
  id: "PLAYER",
  totalTime: 1,
  roomId: "Feedback_Booth",
  changes: {},
  actions: [
    {
      type: "actionAttempt",
      id: "PLAYER",
      attempt: "Ada hands Milton a blank complaint form.",
      success: true,
      minutes: 1,
      resolution: "Milton is now holding the form.",
    },
  ],
});
(reactions ?? []).length >= 1;
=> true
```
