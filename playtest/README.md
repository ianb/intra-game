# Playtest harness

Drive the real engine with a real, small (Haiku-level) model — no OpenRouter
key required — and watch it play. This is the exploratory counterpart to the
deterministic doctests in `test/`: those pin behavior with a scripted fake LLM;
this one exercises the whole game with an actual model to see how it holds up.

```bash
pnpm playtest                       # default intake sequence
pnpm playtest "Hello?" "I'm Ada" "go to the foyer"
```

Each argument is one line of player input. The transcript prints as the story
unfolds; `[llm:<prompt title>]` trace lines go to stderr.

## How it works

`haiku-chat.ts` is a `ChatFn` (the engine's injectable LLM backend) that shells
out to a child `claude -p --model <haiku>` process with tools disabled, so each
call behaves as a single completion. `playthrough.ts` constructs a headless
`Model` with that backend, launches it, feeds the scripted inputs, and renders
the resulting story stream.

Because the engine takes `chat` as a constructor option, wiring a different
model is a one-liner — swap the backend, or point `haikuChat({ model })` at any
model the `claude` CLI accepts.

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

## Caveats

- **Not a test.** Real model calls are non-deterministic and slow (~10–15s per
  call, several per turn); this never runs in CI. Keep deterministic assertions
  in `test/*.doctest.md`.
- **Requires the `claude` CLI** on PATH with working auth. It is a dev tool for
  whoever is iterating on the game, not a build or runtime dependency.
