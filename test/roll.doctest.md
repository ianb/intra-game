# Forcing the d20

`/roll N` at the end of an action forces that attempt's die. Used any other
way it does nothing an observer can see, so misuse gets a guided error in the
transcript instead of silence.

The hint rides the event log (input is parsed wherever the engine runs,
including the server), but as a `uiOnly` event: shown in the transcript,
skipped by history rendering, so meta-text about slash commands never reaches
a character's prompt.

```ts setup
import { entities } from "../lib/game/content/index.js";
import { Model } from "../lib/game/model.js";
import { updatesSeenBy } from "../lib/game/history.js";

const model = new Model(entities, { chat: async () => "" });
model.world.entities.PLAYER.launched = true;

function lastEvent() {
  return model.updates.value.at(-1)!;
}
```

## The good form extracts cleanly

```ts
const parsed = model.parseText("kick the machine /roll 20");
[parsed.roll, parsed.text].join(" | ");
=> 20 | kick the machine
```

## Standalone gets guidance, not silent arming

```ts
await model.sendText("/roll 20");
lastEvent().uiOnly;
=> true
```

``` continue
lastEvent().actions[0]!.text.includes("kick the machine /roll 20");
=> true
```

## Misplaced or bare gets guidance too

```ts
await model.sendText("/roll harder");
lastEvent().actions[0]!.text.includes("needs a number");
=> true
```

## The hint never reaches a prompt

Ama rides with the player, so she witnesses everything in the room — except
interface messages:

``` continue
updatesSeenBy(model.world.entities.Ama).some((event) => event.uiOnly);
=> false
```
