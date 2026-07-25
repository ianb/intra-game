# Working in this repo

Orientation:

- [TODO.md](./TODO.md) — the issue list, and what's known to be broken
- [docs/testing.md](./docs/testing.md) — doctests, cassettes, checkpoints
- [docs/deploying.md](./docs/deploying.md) — the Cloudflare setup
- [playtest/README.md](./playtest/README.md) — driving the engine with a real model
- [evals/README.md](./evals/README.md) — scoring whether a model can run the game

Run `pnpm typecheck`, `pnpm typecheck:worker`, `pnpm lint` and `pnpm test`
before committing. Prompt changes also invalidate the cassettes; see
[playtest/README.md](./playtest/README.md#the-cascade-is-the-point-but-it-should-say-so).

## Writing prose: be careful, and be more careful near the game

Claude has a distinctive writing style. It is recognizable, it is heavy, and in
this repo it is actively harmful, because a lot of the text here is either the
product itself or an instruction to another model.

The common tells, so this is checkable rather than vague:

- em dashes as the default connector, several per paragraph
- corrective negation: "Not a warning." / "This is not X. It is Y."
- a closing line that generalizes the point into an aphorism
- semicolon antithesis: "Re-recording is one command; misdiagnosing it is not."
- "which is the point", "which is what makes it", "worth knowing"
- rule of three, in lists and in sentence rhythm
- understatement used for emphasis

Three zones, with different rules.

**Game content — don't.** `lib/game/content/**` and `docs/dossier.md` are the
author's voice, and that voice is most of what the game is. Adding prose here
dilutes it, and editing existing prose damages it. Propose text in chat and let
Ian write or approve it. Mechanical edits (renaming an id, fixing a broken
reference) are fine.

**Prompts — write flat.** Anything inside a template literal in
`lib/game/classes.ts`, or any other text a runtime model reads, is the highest
risk, because style is transmissible: a model imitates the register of its
instructions. Prose written in Claude's voice in a prompt becomes Ama speaking
in Claude's voice, and every character converges on the same narrator. Write
prompts as plain instructions. State what to do and what not to do. No
rhetorical structure, no aphorisms, no emphasis by understatement.

Prompts are also load-bearing for behavior, not just tone. The `<taskList>`
block took three attempts to get right, and both a longer and a shorter version
scored worse (see the comment above `assemblePrompt` and
[evals/README.md](./evals/README.md#does-the-eval-work)). Change them with
`pnpm evals`, not by taste.

**Engineering prose — acceptable, but lighter than instinct.** Comments, commit
messages, docs, READMEs. The style is tolerable here and the density is not.
Cut the closing aphorism. Cut most of the em dashes. A comment explaining a
non-obvious decision is worth writing; the same comment at half the length is
worth more.

**Nothing automated catches any of this.** The evals score protocol compliance
and world state, and explicitly do not score taste. A person reading the diff is
the only check that exists.
