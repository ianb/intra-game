# Does the eval detect a bad model?

An eval everything passes is indistinguishable from an eval that doesn't work.
The first run of `pnpm evals` scored both Claude tiers 12/12, which is consistent
with "these models play the game fine" and equally consistent with "these checks
never fail".

So the checks are pointed at models that are deliberately bad, here, in the
deterministic suite — no live calls. If a scenario stops distinguishing these
from a real playthrough, the eval has rotted and this fails.

```ts setup
import { runScenario } from "../evals/harness.js";
import { INTAKE_EVAL } from "../evals/scenarios.js";
import { replayChat } from "../playtest/recorded-chat.js";
import type { ChatFn } from "../lib/game/model.js";

const failed = (result: { checks: { name: string; passed: boolean }[] }) =>
  result.checks
    .filter((c) => !c.passed)
    .map((c) => c.name)
    .join(",");

// A model that writes perfectly nice prose and ignores the protocol entirely.
const proseOnly: ChatFn = async () =>
  "Ama's voice fills the room, warm and unhurried. She welcomes you to Intra " +
  "and asks, with evident delight, what she should call you.";

// A model that speaks the protocol but invents things that aren't in the world.
const hallucinating: ChatFn = async () =>
  `<dialog character="Zephyrine">Welcome!</dialog>` +
  `<set attr="Zephyrine.mood">curious</set>`;

// A model that says nothing at all.
const silent: ChatFn = async () => "";
```

A real playthrough — the recorded cassette — passes everything:

```ts
const good = await runScenario(INTAKE_EVAL, replayChat("playtest/cassettes/intake.json"));
[good.passed, good.total].join("/");
=> 7/7
```

Prose with no tags fails `protocol` — the engine wraps loose text into a tag it
then rejects ("Got unexpected tag"), so a model that just talks does register as
breaking the protocol rather than quietly doing nothing. It passes `well-formed`,
because there was no broken markup to repair; the two checks are asking different
questions:

```ts
const result = await runScenario(INTAKE_EVAL, proseOnly);
[result.passed, failed(result)].join(" | ");
=> 1 | protocol,no-dead-turns,name,pronouns,profession,ama-spoke
```

Naming characters and attributes that don't exist is what `protocol` is for —
this is the failure mode that would otherwise look like a working game right up
until nothing happens:

```ts
const result = await runScenario(INTAKE_EVAL, hallucinating);
failed(result).includes("protocol");
=> true
```

An empty response passes both markup checks — there was genuinely nothing for the
engine to object to — and fails everything else, which is what separates "said
nothing wrong" from "played the game":

```ts
const result = await runScenario(INTAKE_EVAL, silent);
[result.passed, failed(result)].join(" | ");
=> 2 | no-dead-turns,name,pronouns,profession,ama-spoke
```

Between them these pin the floor: a model has to actually emit tags, address
things that exist, and move the world into the state the scenario describes.
None of that says the writing is any good — see [evals/README.md](../evals/README.md).
