# Different models for different prompts

The game runs several prompts per turn and they are not the same kind of work.
A character deciding what to say is the game; working out that "look at the
statues" was an examine rather than speech is bookkeeping. There's no reason
both need the same model — but "which prompts can run small" is a question to
measure, not to guess, so the prompt says what *tier* it needs and the
deployment decides what fulfils it.

```ts setup
import { modelForTier, DEFAULT_FLASH_MODEL, DEFAULT_PRO_MODEL } from "../lib/models.js";
```

## A prompt asks for a tier, not a model

```ts
[modelForTier("pro"), modelForTier("flash")].join(" | ");
=> anthropic/claude-sonnet-5 | anthropic/claude-haiku-4-5
```

Unset means pro. Most prompts don't declare a tier, and the ones that matter
most — every character response — are among them:

```ts
modelForTier(undefined) === DEFAULT_PRO_MODEL;
=> true
```

## What fulfils a tier is the deployment's call

A player's OpenRouter selection, a Worker's gateway vars, or an eval trying a
pair:

```ts
const chosen = { pro: "openai/gpt-5.2", flash: "openai/gpt-5.2-mini" };
[modelForTier("pro", chosen), modelForTier("flash", chosen)].join(" | ");
=> openai/gpt-5.2 | openai/gpt-5.2-mini
```

## One model stays one model

The important default. Someone who picked a model expects the game to use it,
and quietly sending a third of their turns to some other model would be a
surprise they never asked for — so an unset flash model falls back to the pro
one, not to a built-in:

```ts
const onlyPro = { pro: "openai/gpt-5.2" };
[modelForTier("flash", onlyPro), modelForTier("flash", onlyPro) === DEFAULT_FLASH_MODEL].join(" | ");
=> openai/gpt-5.2 | false
```

With nothing chosen at all, the built-in tiers apply:

```ts
[modelForTier("flash", {}), modelForTier("pro", {})].join(" | ");
=> anthropic/claude-haiku-4-5 | anthropic/claude-sonnet-5
```

## Why this doesn't cost cache hits

A prefix cache is keyed by (model, exact prefix), so two prompt kinds share a
cache entry only if they share a prefix — and `pnpm playtest:cache` measures
that they don't:

| pair                                     | shared prefix |
| ---------------------------------------- | ------------- |
| `prompt Ama` ↔ `player input`            | 19 chars      |
| `prompt Ama` ↔ `player examine`          | 19 chars      |
| `prompt Ama` ↔ `player action`           | 19 chars      |
| `player examine` ↔ `player input`        | 166 chars     |

Nineteen characters out of thousands. Character prompts and player-side prompts
were never in the same cache entry, so sending the player-side ones to a small
model cannot cost a character prompt a single hit. The cache barrier doesn't
move.

The same measurement says which prompts are worth moving, and the answer is
convenient: `prompt Ama` reuses **86%** of its text once the player's name is
known, while `player input` reuses **8%** — it carries the room, who's in it and
the exits, all of which change every turn. The prompts with the least to lose
from a cold cache are exactly the mechanical ones.

That's a fact about today's prompts, not a law. `pnpm playtest:cache` is the
thing that would notice if a refactor gave the two kinds a shared preamble, at
which point this reasoning stops holding.
