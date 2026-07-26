# What a model playing the game is allowed to see

Letting a model play the game only measures anything if the model can't see the
answer. The engine has it sitting in plain English —
`Ink_And_Echo.revealedHints.Marta` begins "Marta is actually Ink and Echo" — so a
view assembled from world state would produce a confident score that means
nothing at all.

So the view is built from the interface, not the world: story events, the room,
its exits, who is visibly present, the task list, and the *names* of open
mysteries. A name is the question ("Who is writing notes as 'Ink and Echo'?");
the hints are the answer, and they are never read.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { playerView, renderPlayerView } from "../evals/playerview.js";
import { extractCommand } from "../evals/llmplayer.js";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

// A real game, mid-story: the briefed checkpoint has the mystery revealed and
// the player out in the complex, which is the state a quest starts from.
const model = new Model(entities, { chat: async () => "" });
model.replaceLog(parse(readFileSync("playtest/checkpoints/briefed.yaml", "utf8")).events);
const view = playerView(model);
const rendered = renderPlayerView(view);
```

## The answer is not in there

Marta is the poet. Every character who knows something about her carries it in a
hint, and none of that is reachable from the view:

```ts
[
  rendered.includes("Marta is actually"),
  rendered.includes("obscure it from the records"),
  rendered.includes("Yellow Room"),
].join(" ");
=> false false false
```

Neither is anyone else's private knowledge — Ama's steer toward Harold and Lily,
the Archivist's paper requisitions, Gloria's theory:

```ts
[
  rendered.includes("last two people to find notes"),
  rendered.includes("paper requisitions"),
  rendered.includes("suspects the author spends time"),
].join(" ");
=> false false false
```

Nor the machinery: no prompts, no schedules, no entity ids where names belong.

```ts
[
  rendered.includes("roleplayInstructions"),
  rendered.includes("<dialog"),
  rendered.includes("Hollow_Atrium"),
].join(" ");
=> false false false
```

## What it does see

The question, not the answer:

```ts
view.mysteries.join(" | ");
=> Who is writing notes as 'Ink and Echo'?
```

Where it is, and where it can go — by name, as the interface shows them:

```ts
[view.room.startsWith("The Hollow Atrium"), view.exits.includes("Intake Foyer")].join(" ");
=> true true
```

And the story so far, which is where Ama's briefing lives — the model gets the
premise the way a player does, by having been told it:

```ts
view.transcript.some((line) => line.includes("Ink and Echo"));
=> true
```

## Invisible characters stay invisible

Ama is a voice from the ceiling, not someone in the room. The view uses the same
filter the interface does, so she is heard in the transcript and never listed as
present:

```ts
view.people.includes("Ama");
=> false
```

## Reducing a reply to a command

Models narrate even when told not to. A reply that arrives dressed up is a
player who wanted to do the thing, not a protocol failure, so the first line
with content is taken and stripped:

```ts
[
  extractCommand("go north"),
  extractCommand("**ask Harold about the poems**"),
  extractCommand('"look at the desk"'),
  extractCommand("\n\n- talk to Marta"),
].join(" | ");
=> go north | ask Harold about the poems | look at the desk | talk to Marta
```

An empty reply yields nothing rather than a made-up command; the runner stops
rather than inventing a turn the player didn't take:

```ts
JSON.stringify(extractCommand("   \n  \n"));
=> ""
```
