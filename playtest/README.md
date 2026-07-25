# Playtest harness

Drive the real engine with a real, small (Haiku-level) model — no OpenRouter
key required — and watch it play. This is the exploratory counterpart to the
deterministic doctests in `test/`: those pin behavior with a scripted fake LLM;
this one exercises the whole game with an actual model to see how it holds up.

For _scoring_ how well a model plays rather than reading a transcript, see
[../evals/](../evals/README.md), which reuses this backend.

```bash
pnpm playtest                       # default intake sequence
pnpm playtest "Hello?" "I'm Ada" "go to the foyer"
pnpm playtest --from briefed -i     # play on from a saved state, by hand
```

Each bare argument is one line of player input. The transcript prints as the
story unfolds; `[llm:<prompt title>]` trace lines go to stderr. `-i` /
`--interactive` hands you a prompt when the scripted input runs out, so you can
keep playing.

## How it works

`clichat.ts` is a `ChatFn` (the engine's injectable LLM backend) that shells
out to a child `claude -p --model <haiku>` process with tools disabled, so each
call behaves as a single completion. `playthrough.ts` constructs a headless
`Model` with that backend, launches it, feeds the scripted inputs, and renders
the resulting story stream.

Because the engine takes `chat` as a constructor option, wiring a different
model is a one-liner — swap the backend, or point `cliChat({ model })` at any
model the `claude` CLI accepts.

## Checkpoints: don't start from the beginning

Every look at the game used to start at its first line, which put the later two
thirds of Intra effectively out of reach: reaching the Ink and Echo mystery
costs a dozen live calls of intake and walking, and anything going wrong on the
way looks like a failure of whatever you were actually trying to see.

A checkpoint is a saved game state under `checkpoints/`, and `--from` starts
there instead:

```bash
pnpm playtest --from briefed -i                      # play on from it, by hand
pnpm playtest --from briefed "search the atrium"     # or with a script
pnpm checkpoint --list                               # what's saved, and how
```

**A checkpoint is just an event log.** The whole world is a fold over that log,
so replaying one puts the world exactly where that game was — the same
schedules, the same rooms visited, the same things Ama has learned. Nothing is
serialised specially and nothing can drift out of step with the engine, because
the log _is_ the state. It's the same mechanism as loading a save.

### Making one

Play to somewhere interesting and keep it:

```bash
pnpm playtest --from briefed -i \
  --save atrium-searched --describe "searched the atrium, found the note"
```

Everything typed is recorded along with the state, so the checkpoint carries the
recipe that produced it and can be rebuilt rather than guessed at:

```bash
pnpm checkpoint atrium-searched     # re-record it against a live model
pnpm checkpoint --force             # re-record everything
```

Checkpoints chain — a saved fork of a fork stores `from:`, so a deep state is
built out of shallow ones rather than one long fragile script. They're recorded
against a real model on purpose: a state reached by a scripted fake is one no
real game passes through, and anything resuming from it would be exercising a
fiction.

### Say what it means

A checkpoint that anything depends on should also have an entry in
[checkpoints.ts](./checkpoints.ts), whose one job is an `expect` predicate — the
thing a YAML file can't carry. The recorder **refuses to save** a checkpoint
that misses it.

That isn't hypothetical caution. The first recording of `briefed` walked into
the Foyer's locked door, stopped a room short with the mystery still veiled, and
saved perfectly happily. A checkpoint holding the wrong state poisons everything
that resumes from it, and the failures surface somewhere else entirely.

Ad-hoc checkpoints saved from a playtest have no predicate, and
`pnpm checkpoint --list` marks them so. That's fine for exploring; add one
before something starts depending on it.

## Cassettes: record once, replay deterministically

Live model calls are great for exploring but useless as a regression test —
they're slow and non-deterministic. So we **record** a playthrough's replies
once and replay them in the test suite.

```bash
pnpm playtest:record            # (re-)record cassettes with missing entries
pnpm playtest:record intake     # just the named scenario
```

- `scenarios.ts` defines each scenario: a **seed**, an input script, and a
  cassette path. The seed makes the whole run deterministic (`seed.ts` swaps in
  a seeded `Math.random`), so the schedule and every prompt reproduce exactly.
- `recorded-chat.ts` provides `recordingChat` (wraps the real Haiku backend,
  caching each reply to `cassettes/<name>.json`, keyed by a hash of the prompt)
  and `replayChat` (serves those cached replies; unknown prompts return `""`).
- `cassettes/*.json` are committed fixtures — the real model's replies, frozen.

A test then replays the cassette with no live model — see
`test/playthrough-intake.doctest.md`, which plays the full intake conversation
and asserts the engine reaches the right state. Re-record when the prompts or a
scenario change (a changed prompt is a new hash, so stale entries simply stop
being hit — delete the cassette and re-record for a clean cut).

### The cascade is the point, but it should say so

Keying on the whole prompt means one edit invalidates every entry at once, which
looks like fragility and mostly isn't. The alternative — key on less, so small
prompt changes keep hitting — sounds better and is worse: the system prompt is
where character instructions live, so ignoring part of it means a change that
_should_ change the model's behaviour silently replays replies from before it.
That trades a loud failure for a quiet wrong answer, on a fixture whose entire
job is standing in for a real model.

So the cassette over-invalidates on purpose. What it owes you in exchange is
being obvious about it: a miss now prints what's stale and the command to fix
it, because the silent version failed on game _state_ — "the player has no
name", "Ama never finished intake" — which reads as a broken engine rather than
an old recording. Re-recording is one command and a few minutes; misdiagnosing
it is not.

The corollary is to keep few cassettes and record short scenarios, since the
cost of invalidation scales with how much has been recorded, not with how much
changed. When a test only needs _some_ model reply rather than a real one, use a
scripted fake instead — `test/headless-engine.doctest.md` is the pattern, and it
never goes stale.

## Caveats

- **Not a test.** Real model calls are non-deterministic and slow (~10–15s per
  call, several per turn); this never runs in CI. Keep deterministic assertions
  in `test/*.doctest.md`.
- **Requires the `claude` CLI** on PATH with working auth. It is a dev tool for
  whoever is iterating on the game, not a build or runtime dependency.
