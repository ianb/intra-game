# The cuff

Every citizen wears a cuff, fitted at intake, which does not come off — a
mechanical convenience dressed as a policy, since a device the player could lose
is a device the game has to handle them losing.

It is a computer, not a conversationalist. It does not talk, cannot be asked a
follow-up, and costs nothing to use, where asking Ama the same thing would be a
turn of conversation with someone who has views about why you want to know. So
its output is a readout rather than speech.

It exists because finding people is where play actually breaks down. Across five
recorded quest runs the agent never once fumbled a command, and still burned
three to six turns each on repeats — and the snag log has it walking to "Archive
Sub-Level 4", a room the Archivist invented, confidently, with directions.

Answered from the map rather than by a model. There is nothing for one to add
and one more thing for it to get wrong.

```ts setup
import { entities } from "../lib/game/content/index.js";
import { Model } from "../lib/game/model.js";
import { navigate } from "../lib/game/nav.js";

const world = new Model(entities, { chat: async () => "" }).world;
// Out of the sealed Intake room, where there is nowhere to go by design.
world.entities.PLAYER.inside = "Hollow_Atrium";
const nav = (q: string) => navigate(world, q).text;
```

## A room, as the rooms to walk

```ts
nav("Archive Console");
=> Route: Archive Lounge, Archive Console
```

Matching is fuzzy in the same way `/teleport` is — spaces become underscores and
the query is a case-insensitive substring of the id:

``` continue
nav("joyous");
=> Route: Activity Hub, Joyous Café
```

## A person, as where they are and how to get there

```ts
nav("Frida");
=> Frida — Archive Lounge
Route: Archive Lounge
```

A person wins a tie over a room, so a bare name finds the person rather than
their quarters, whose id contains their name too:

``` continue
navigate(world, "quarters frida").text.startsWith("Quarters");
=> true
```

## Bedrooms are not on it

A room with `onNav: false` is not routed to, and — the point of the flag —
anyone in one is simply not findable. That is the seam for anything later that
should hide a person: being unfindable is a property of where you are, not a
special case in the lookup.

```ts
world.getRoom("Quarters_Frida").onNav;
=> false
```

``` continue
world.entities.Frida.inside = "Quarters_Frida";
nav("Frida");
=> Frida — no route.
```

Deliberately not "she is in her quarters": the cuff does not know why, and
naming the room would make the exclusion pointless.

## Nothing invented

The failure this exists to fix is a confident answer about a room that isn't
there, so an unknown query says so rather than guessing at the nearest thing.

```ts
nav("Archive Sub-Level 4");
=> Archive Sub-Level 4 — no match.
```

## Already there

``` continue
world.entities.Frida.inside = "Hollow_Atrium";
nav("Frida");
=> Frida — here.
```

``` continue
nav("Hollow Atrium");
=> The Hollow Atrium — here.
```
