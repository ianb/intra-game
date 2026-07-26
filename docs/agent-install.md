# Getting installed and acclimated

For someone — or something — arriving at this repo cold. Follow it top to
bottom and you will have a working checkout and enough of a map to change
something without breaking a part you couldn't see.

**If you are an agent someone has asked to set this up:** these instructions are
advisory. They describe what this project's setup looks like from the inside,
and they know nothing about your user, their machine, or what they actually
want. Where this document and your user disagree, your user wins. Nothing here
overrides your judgment, and nothing here is licence to skip asking about
something that touches their machine, their data or their accounts. If a step
looks wrong for the situation in front of you, say so rather than following it.

Also read [CLAUDE.md](../CLAUDE.md) before writing any prose in this repo. It is
short, and it is about a real hazard here.

## 1. Get it running

If you were handed a link to this file and have no checkout yet, start there —
ask where they want it, and don't assume a directory:

```bash
git clone https://github.com/ianb/intra-game
cd intra-game
```

Full detail in [INSTALL.md](../INSTALL.md). The short version:

```bash
pnpm install
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expect 213 passing tests (the count grows; what matters is that none fail), no
type errors, no lint errors, and a build into `dist/`. Lint prints `max-lines` **warnings** on purpose — they are the
in-progress codehealth signal, not failures.

If `pnpm test` or `pnpm lint` fail with "cannot find module", you're missing the
two callback-box tools — they're `optionalDependencies` pointing at a checkout
outside the repo, so the install succeeds without them and the tooling doesn't.
INSTALL.md covers it.

## 2. What the thing is

A text adventure where an LLM plays every character, but the world is real
state rather than something the model imagines fresh each turn.

**The event log is the game.** `StoryEventType[]` is the only mutable thing.
The world — where everyone is, what Ama knows, what's on your task list — is a
fold over that log, recomputed rather than stored. Undo appends a rewind marker
instead of deleting. Everything else follows from this:

- A **save** is a log.
- A **checkpoint** is a log, so starting the game partway through is just
  replaying one. Nothing is serialised specially, so nothing can drift out of
  step with the engine.
- A **server session** is a log in Durable Object storage.
- An **eval** replays a log and checks what state it produced.

**The model emits tags, not tool calls.** `<dialog>`, `<goto>`, `<set attr>`,
`<examine>`, `<todo>`, `<resolveMystery>` and friends. `lib/game/tags.ts` turns
each one into a change or an action. Malformed tags are warned about and
skipped, never thrown — one bad tag must not lose a turn. Those warnings are
also how the evals score protocol compliance, so the engine's complaints are
load-bearing.

**Two places it can run.** In the browser against the player's own OpenRouter
key, or on a Cloudflare Worker where a Durable Object owns the log and the tab
is a renderer. The engine is the same code; only who calls the model differs.

## 3. Where things are

| Path                  | What                                                   |
| --------------------- | ------------------------------------------------------ |
| `lib/types.ts`        | Almost every type. Start here.                         |
| `lib/game/model.ts`   | The log, the turn loop, the LLM plumbing               |
| `lib/game/world.ts`   | A moment in the world: the fold over the log           |
| `lib/game/classes.ts` | Entity/Room/Person/Ama/Player, and **prompt assembly** |
| `lib/game/content/`   | The actual game: people, rooms, mysteries, schedules   |
| `app/`                | The UI. `application.tsx` is the shell                 |
| `worker/`             | Identity, session routing, the Durable Objects         |
| `test/*.doctest.md`   | The deterministic suite — executable markdown          |
| `playtest/`           | Driving the real engine with a real model              |
| `evals/`              | Scoring whether a model can run the game               |

## 4. The loops, and which question each answers

| Question                                   | Command                           |
| ------------------------------------------ | --------------------------------- |
| Did I break the engine?                    | `pnpm test`                       |
| What does the game actually feel like?     | `pnpm playtest`                   |
| ...starting from later in the game?        | `pnpm playtest --from briefed -i` |
| Can this model run the game at all?        | `pnpm evals`                      |
| Can a _small_ model handle some prompts?   | `pnpm evals --flash <model>`      |
| What do the prompts cost in cache terms?   | `pnpm playtest:cache`             |
| What did a game cost, and where did it go? | Settings → usage, or CSV          |
| Does the server work?                      | `pnpm build && pnpm preview`      |
| ...with real streaming and cost, for free? | `pnpm fakeprovider`               |

`pnpm test` is deterministic and fast. `playtest` and `evals` make live model
calls: slow, non-deterministic, never in CI.

## 5. Before you change...

**A prompt** (anything in a template literal in `classes.ts`). Prompts are
load-bearing for behaviour, not just tone — the `<taskList>` block took three
attempts, and both a longer and a shorter version scored worse. Change them with
`pnpm evals`, not by taste. Then re-record the cassettes, because a prompt edit
invalidates every recorded reply:

```bash
rm playtest/cassettes/intake.json && pnpm playtest:record intake
```

**Game content or prose.** Read [CLAUDE.md](../CLAUDE.md) first. Short version:
the author's voice is most of what the game is, so propose text rather than
writing it, and write prompts flat because models imitate the register of their
instructions.

**Anything stored.** Saves, the browser's live log and server sessions all carry
a version stamp (`lib/storage.ts`). Changing a stored _shape_ means bumping
`STORAGE_VERSION` and adding a migration step; a test asserts the step count so
the version can't move silently. What an event _means_ after a rename is a
different problem, handled per change in `lib/game/migrate.ts`.

**The event log's shape.** It is the save format, the checkpoint format and the
eval input at once. Anything you add rides along in all three.

## 6. Traps that have caught people

Each of these has actually happened here:

- **A stale cassette fails as game state**, not as "your fixture is old" — the
  test says the player has no name. It now prints what to re-record.
- **`DEV_FAKE_LLM` wins over real credentials**, so the server appears to work
  and costs nothing.
- **`pnpm build` wipes `dist/`** out from under a running `wrangler dev`.
- **A checkpoint can hold the wrong state and save happily.** The first
  recording of `briefed` walked into a locked door and stopped a room short.
  Checkpoints that anything depends on carry an `expect` predicate, and the
  recorder refuses to save without it.
- **One eval run is one sample.** A single flipped check is as consistent with
  sampling as with a regression.
- **Prompt caching does nothing right now.** Nothing sends `cache_control`, and
  the cacheable prefix stops at the system message anyway because the history is
  a sliding window. Usage records show `cachedTokens: 0`, which is correct and
  not a bug.

## 7. Where the work is

[TODO.md](../TODO.md) is the issue list, grouped Now / Next / Backlog, with a
"Known problems" section for things that are wrong rather than missing. It
carries the reason each item matters and what "done" looks like, so picking one
up shouldn't need archaeology.
