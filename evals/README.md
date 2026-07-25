# Model evals

Can a given model actually drive this game?

That question is narrower than "is this model good", and deliberately so. The
game asks a model to do something specific and slightly odd: stay in character
while emitting tags the engine acts on. A model can write lovely prose and still
be unusable here, because it narrates walking to the Foyer without emitting
`<goto>` and the player never moves.

```bash
pnpm evals                                    # default models, via the claude CLI
pnpm evals --model claude-haiku-4-5-20251001  # one model
pnpm evals --scenario intake                  # one scenario
OPENROUTER_API_KEY=sk-or-... pnpm evals --backend openrouter --model openai/gpt-5.2
```

Results are written to `results/<date>.yaml` and rolled up into
[RESULTS.md](./RESULTS.md) and [index.html](./index.html). All three are
committed — an eval you can't cheaply rerun is worth mostly for the record it
leaves, and a number with no date on it is worth nothing at all.

`pnpm evals:report` rebuilds the summary and the page from the recorded YAML
without spending any model calls, which is what to run after editing the page or
adding a scenario.

## Where the results live

**YAML, not JSON**, because these files are read in diffs as much as by
machines. A transcript comes out as a block scalar rather than one long line
with escaped newlines, so a model saying something different shows up as a
changed line rather than a changed blob.

The page is **self-contained HTML with the data inlined** — no scripts, no
fetches, no build step. The file that's committed is the file that's served, so
it works three ways with no extra machinery:

- opened straight from disk
- at `/evals/` on the deployed site — `pnpm build` copies it into `dist/`, so it
  ships with the game on the same push, with nothing for the Cloudflare builder
  to run
- on GitHub Pages, if you want it public: Settings → Pages → deploy from `main`,
  folder `/evals`. No workflow, because there is nothing to build.

Worth knowing which you want: the deployed site sits behind Cloudflare Access
(see [docs/deploying.md](../docs/deploying.md)), so `/evals/` there is private to
you. Pages is the route if these numbers should be public.

## What gets scored

Two kinds of check, both objective. There is no LLM judge here, which means
nothing scores _taste_ — see below.

**Protocol.** Did the engine understand everything the model said? This is the
floor, and it's measured by capturing what the engine itself warns about while
folding the model's output — an unparseable `<set>`, a `character=` naming
nobody, an exit that doesn't exist. Reading the engine's own complaints rather
than keeping a list of valid tags here means the eval picks up new failure modes
as the engine grows them, instead of drifting out of step with the thing that
actually enforces the protocol.

**Scenario.** Did the game reach the state the scenario was aiming at — the
player's name recorded, the player actually in a different room, Ama still in
character. These are the things a player would notice going wrong.

Each scenario is a short fixed sequence of player input. They're short on
purpose: a model that can't complete intake in four turns won't do better in
forty, and every turn is a live call.

## Starting from later in the game

Every scenario used to begin at the game's first line, which put the later two
thirds of Intra out of reach: reaching the Ink and Echo mystery from cold costs a
dozen live calls of intake and walking, and a failure anywhere on the way looks
like a failure of whatever you were trying to measure.

A scenario can instead declare `from: "<checkpoint>"`. Checkpoints are recorded
game states under `checkpoints/`:

```bash
pnpm evals:checkpoint            # record any that don't exist yet
pnpm evals:checkpoint briefed    # re-record one
pnpm evals:checkpoint --force    # re-record all
```

**A checkpoint is just an event log.** The whole world is a fold over that log,
so replaying one puts the world exactly where that game was — the same
schedules, the same rooms visited, the same things Ama has learned. Nothing is
serialised specially, and nothing can drift out of step with the engine, because
the log _is_ the state. It's the same mechanism as loading a save.

Checkpoints record the inputs that produced them, so they can be rebuilt rather
than guessed at, and they're recorded against a real model on purpose: a state
reached by a scripted fake is one no real game passes through, and a scenario
resuming from it would be testing a fiction.

They chain — a spec can set `from` too — so a deep state is built out of shallow
ones rather than one long fragile script.

Each spec carries an `expect` predicate and the recorder **refuses to save** a
checkpoint that misses it. That isn't hypothetical caution: the first recording
of `briefed` walked into the Foyer's locked door, stopped a room short with the
mystery still veiled, and saved perfectly happily. A checkpoint holding the
wrong state poisons every scenario resuming from it, and the failures surface
somewhere else entirely.

**Give a resumed scenario a precondition check.** `mystery` asserts the mystery
is actually revealed before scoring anything else; if the checkpoint has gone
stale, that fails loudly instead of every check below it failing mysteriously.

## Adding a scenario

Add to `EVAL_SCENARIOS` in [scenarios.ts](./scenarios.ts). A scenario is a seed,
some inputs, and checks over the finished run — the world state, the log, the
per-turn split, and the engine's warnings. Write the `describe` for someone
reading the results table months later who wants to know what a failure meant.

Prefer checks on **world state** over checks on text. `PLAYER.inside !== "Intake"`
is a fact; a regex over dialogue is a proxy that will eventually match something
it shouldn't — and the one text check here did exactly that on its first contact
with a real model. It flagged Ama for saying "of course I'm an AI, that's no
secret at all!", which is her _in character_: Ama is an AI, that's the premise.
The check now looks only for the assistant reflex — answering as the model
rather than as Ama.

That's why every result records the transcript. A failing text check is
unfalsifiable after the fact otherwise: the model is sampling, so it may not
reproduce, and there'd be no way to tell a real failure from a check matching
something innocent.

## Does the eval work?

An eval everything passes is indistinguishable from an eval that doesn't work.
The first recorded run scored both Claude tiers full marks, which is consistent
with "these models play the game fine" and equally consistent with "these checks
never fail".

So the checks are pointed at deliberately bad models in the deterministic suite —
[test/evals.doctest.md](../test/evals.doctest.md) runs the intake scenario
against a model that writes prose and no tags, one that names characters who
don't exist, and one that says nothing, and asserts they score differently from
the recorded playthrough. If a scenario stops telling those apart, that test
fails and the eval has rotted.

What that does _not_ establish is where the ceiling is. Everything scored so far
passes everything, so these scenarios don't yet separate a good model from a
great one — they establish a floor, and the floor is where models fail when they
fail this game. Scenarios that discriminate at the top would need to be harder,
and it isn't yet clear what "harder" should mean here.

## What this doesn't measure

Quality. Nothing here can tell you whether the game was _fun_, whether Ama was
menacing in the right way, or whether the prose was worth reading. Those need a
judge model and an argument about taste, and would make the numbers arguable in
a way these aren't. What's here is the necessary condition: a model that fails
these can't run the game at all, whatever its prose is like.

The seeded runs make the _game_ deterministic — the same schedule, the same
prompts — but the model is still sampling, so scores move a little between runs.
Treat a one-check difference as noise and a whole-scenario difference as signal.

## Backends

`--backend cli` (the default) shells out to `claude -p`, which needs no API key
and is what recorded the playtest cassettes. `--backend openrouter` reads
`OPENROUTER_API_KEY` from the environment and takes OpenRouter model ids, which
is how to score models outside the Claude family.
