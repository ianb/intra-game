# Asking Ama where something is

`/nav <room or person>` is directions, from Ama, as an ordinary line in the
transcript. It is play rather than a dev command: Intra is run by an AI who
monitors everyone and is relentlessly helpful about small practical things, and
asking her where somebody is is exactly what she is for.

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
=> Go to Archive Lounge, then Archive Console.
```

Matching is fuzzy in the same way `/teleport` is — spaces become underscores and
the query is a case-insensitive substring of the id:

``` continue
nav("joyous");
=> Go to Activity Hub, then Joyous Café.
```

## A person, as where they are and how to get there

```ts
nav("Frida");
=> Frida is in Archive Lounge. Go to Archive Lounge.
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
=> I can't help you find Frida at the moment. They aren't anywhere I can direct you to.
```

Deliberately not "she is in her quarters". Naming the room would make the
exclusion pointless.

## Nothing invented

The failure this exists to fix is a confident answer about a room that isn't
there, so an unknown query says so rather than guessing at the nearest thing.

```ts
nav("Archive Sub-Level 4");
=> I don't have anywhere called "Archive Sub-Level 4" on the map, and nobody by that name.
```

## Already there

``` continue
world.entities.Frida.inside = "Hollow_Atrium";
nav("Frida");
=> Frida is here, with you.
```

``` continue
nav("Hollow Atrium");
=> You're in The Hollow Atrium now.
```
