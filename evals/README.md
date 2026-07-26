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

A scenario can instead declare `from: "<checkpoint>"` and start from a recorded
game state — see [checkpoints in the playtest
README](../playtest/README.md#checkpoints-dont-start-from-the-beginning) for
what those are and how to make one. Scenarios use the same forking machinery as
`pnpm playtest --from`, so a state you can play from by hand is a state you can
score against.

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

What that does _not_ establish is where the ceiling is. The tiers scored so far
land within a check of each other, so these scenarios don't separate a good
model from a great one — they establish a floor, and the floor is where models
fail when they fail this game. Scenarios that discriminate at the top would need
to be harder, and it isn't yet clear what "harder" should mean here.

They do already catch prompt regressions, which was not the plan. The first
wording of the `<taskList>` instructions got tasks created and made both tiers
sloppier elsewhere — `movement` started dropping a hallucinated `<set>` on a
scenario that had been clean. Cutting the block to two sentences fixed that and
stopped tasks being created at all. The wording that shipped is the one that
scored on both. Note the sample size, though: **one run is one sample**, and a
single flipped check is as consistent with sampling as with a regression.

## Which prompts a number was measured against

Every result records a `promptFingerprint` — a short hash of the prompts the
game actually assembles, taken by running the engine against a scripted LLM (no
cassette, no network) at the start of a run.

It exists because comparing numbers across weeks always raises the same
question: did the game change, or is the model just sampling? The date and the
model id can't answer it. Two runs with the same fingerprint were asked the same
questions; two with different fingerprints weren't, and a difference between
them isn't a difference in the model.

Note what this deliberately does **not** do: nothing is invalidated by it. A
number measured against an old prompt is still a fact about that prompt, and
results are kept, not expired. That's the opposite of how the cassettes treat
staleness, and the difference is the point — a cassette is a _cache_, where a
stale entry is a wrong answer, so it over-invalidates and says so loudly.
Results are a _record_, where deleting on change would throw away the history
that makes them worth keeping. Fingerprints differing within one day's table is
normal, and the table says so rather than hiding it.

## What this doesn't measure

Quality. Nothing here can tell you whether the game was _fun_, whether Ama was
menacing in the right way, or whether the prose was worth reading. Those need a
judge model and an argument about taste, and would make the numbers arguable in
a way these aren't. What's here is the necessary condition: a model that fails
these can't run the game at all, whatever its prose is like.

The seeded runs make the _game_ deterministic — the same schedule, the same
prompts — but the model is still sampling, so scores move a little between runs.
Treat a one-check difference as noise and a whole-scenario difference as signal.

## Trying a small model for some prompts

The game runs several prompts per turn and they are not the same kind of work.
A character deciding what to say is the game; working out that "look at the
statues" was an examine rather than speech is bookkeeping. Each prompt declares
which **tier** it needs (`lib/models.ts`), and a run can fulfil the cheap tier
with a different model:

```bash
pnpm evals --model claude-sonnet-4-5-20250929 --flash claude-haiku-4-5-20251001
```

The pair is recorded with the results, so a row that scored well on a mixed
setup is distinguishable from one that didn't.

**Caching is not the obstacle**, which is worth knowing before designing around
it. A prefix cache is keyed by (model, exact prefix), and `pnpm playtest:cache`
reports that a character prompt shares **19 characters** with any player-side
prompt — out of thousands. They were never in the same cache entry, so routing
one kind to a small model cannot cost the other a single hit. The prompts worth
moving are also the ones with the least to lose: `prompt Ama` reuses 86% of its
text once the player is named, `player input` reuses 8%.

What is left is the actual question — whether a small model gets these prompts
_right_ — and that's what running the scenarios both ways answers. Today only
`player input` and `describe people` ask for the cheap tier; `player examine`,
`player move` and `player action` are on the expensive one because that is what
they have always been, not because anyone has checked.

## Letting a model play

Everything above scores whether a model can _run_ the game. This asks the
opposite question — whether the game can be **solved** by someone who isn't the
author:

```bash
pnpm evals:play                                     # Sonnet plays a Haiku game
pnpm evals:play --model claude-sonnet-4-5-20250929  # ...and a Sonnet game
pnpm evals:play --player openai/gpt-5.2 --backend openrouter
```

The two roles default to different models, because they are not equally hard.
Being an NPC is bounded: respond in character, once, to what is in front of you.
Playing is open-ended — hold a goal for twenty turns, remember what you have
already tried, and decide where to go next with nothing prompting you. The game
targets a Haiku-class model and that stays the default for _running_ it; a
Haiku-class player is below the floor for _playing_, and a quest it fails tells
you nothing about the puzzle.

A quest starts from a checkpoint, shows the model exactly what the interface
shows, and lets it type one line at a time until it solves the mystery or runs
out of turns. `--player` and `--model` are separate because "this puzzle is
unsolvable" and "this player is bad at adventure games" look identical from a
single run, and varying them independently is the only way to tell them apart.

**The scoring is milestones, not pass/fail.** Solved-or-not says nothing about
_where_ a player got stuck, which is the entire reason to run this. The Ink and
Echo quest tracks leaving the atrium, meeting one of the two people who found a
note, reaching the Archivist, reaching Marta, and solving — so a run that stalls
tells you which step is too hard to find. Repeated commands and rooms visited
are recorded too, since a player going in circles is a different failure from a
player exploring and coming up empty.

**What the player sees is the whole design.** The engine holds the answer in
plain English — one hint begins "Marta is actually Ink and Echo" — so a view
built from world state would produce a confident number that means nothing.
`playerview.ts` assembles the view from the interface instead: story events, the
room, its exits, who is visibly present, the task list, and the _names_ of open
mysteries. A name is the question; the hints are the answer, and they are never
read. [test/playerview.doctest.md](../test/playerview.doctest.md) checks that by
looking for the answer in the rendered view.

Results go to `quests/`, one file per run, transcript included. These are slow
and cost real calls — one player call plus several game calls per turn — so they
are run deliberately rather than as part of `pnpm evals`.

## Backends

`--backend cli` (the default) shells out to `claude -p`, which needs no API key
and is what recorded the playtest cassettes. `--backend openrouter` reads
`OPENROUTER_API_KEY` from the environment and takes OpenRouter model ids, which
is how to score models outside the Claude family.
