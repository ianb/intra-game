# Testing & dev tooling

The engine's testable logic is covered with **[agent-doctest](https://github.com/ianb/agent-doctest)**:
tests are executable markdown (`test/**/*.doctest.md`) where each fenced code
block is both documentation and a [tap](https://node-tap.org/) test case. Prose
between blocks explains intent; the code blocks keep it honest.

```bash
pnpm test           # run all doctests (tap)
pnpm test:watch     # re-run on change
pnpm typecheck      # tsc --noEmit under the strict config
pnpm lint           # eslint (flat config, personal-vibe-check preset)
pnpm lint:fix       # autofix what it can
pnpm lint:oxlint    # supplemental fast linter
pnpm lint:circular  # madge, value-import cycles only
pnpm format         # prettier
```

`eslint.config.mjs` layers this project's decisions over the shared preset, and
every rule turned off there carries the reason inline. `max-lines` and
`max-lines-per-function` are deliberately warnings — they're the in-progress
codehealth signal — so `pnpm lint` stays a meaningful gate while that work
continues. `lib/game/content/**` gets a larger `max-lines` of its own, because
prose isn't complexity.

`@typescript-eslint/no-explicit-any` **is** an error. It started as a warning
covering 71 occurrences; there are now two, both the `ChangeType` before/after
payloads, disabled inline where they're declared. Two escape hatches keep it
that way, and new code should reach for them rather than a local `as any`:

- **`lib/game/dynamic.ts`** for the entity model's dynamism — `<set
attr="PLAYER.name">` addressing a field by string, or indexing the world by
  entity id. `fieldsOf(entity)` and `entitiesById(entities)`.
- **`lib/debugglobal.ts`** for hanging something off `window` to poke at from
  the console. `exposeGlobal(name, value)` is a no-op outside the browser, so
  engine code carrying one still runs in a Worker.

Write a doctest as a `.doctest.md` under `test/`. A `ts setup` block holds the
imports; regular blocks are examples where an expression followed by `=>` is
checked against the expected value. See `test/parsetags.doctest.md` for a
worked example and the agent-doctest README for the full syntax.

`test/headless-engine.doctest.md` shows the engine being driven headless with a
scripted (deterministic) fake LLM — the pattern for engine-level tests.

## Model evals

`pnpm evals` scores whether a given model can actually drive the game — it plays
fixed scenarios against a real model and checks both that the engine understood
every tag, and that the game reached the state the scenario aimed at. Results are
committed under `evals/results/` and summarised in
[evals/RESULTS.md](../evals/RESULTS.md). See [evals/README.md](../evals/README.md)
for what is and isn't measured.

## Playtesting with a real model

For exploratory playtesting against a real Haiku-level model (non-deterministic,
not part of the test suite), see [`playtest/`](../playtest/README.md):

```bash
pnpm playtest "Hello?" "I'm Ada" "go to the foyer"
```

## Setup notes (why the config looks the way it does)

Getting agent-doctest running against this repo surfaced a few sharp edges,
recorded here so they aren't rediscovered:

- **`"type": "module"` is required.** agent-doctest generates each `.doctest.md`
  as an ESM module. In a CommonJS package, tsx mis-infers the format of imported
  `.ts` files (ESM vs CJS) when the import parent is the `.doctest.md` URL, and
  named imports fail with "does not provide an export named …". All source here
  is already ESM `import`/`export`, so the package is `type: module`.
- **`.taprc` disables Node's native TS stripping** (`--no-experimental-strip-types`)
  so tsx owns all `.ts` loading, and drops the `@tapjs/typescript` plugin in
  favor of tsx.
- **`.npmrc` sets `node-linker=hoisted`.** This project uses pnpm, and the
  callback-box tools are consumed as local `file:` dependencies. With pnpm's
  default isolated linker, their peer imports (`@tapjs/core`, …) would resolve
  against the callback-box checkout (which has no `node_modules`) instead of this
  repo's. The hoisted (flat) linker puts everything in one `node_modules` so
  resolution works — the same reason it matches callback-box's own `.npmrc`.

## callback-box dependencies (not yet on npm)

`@ianbicking/personal-vibe-check` (strict tsconfig + lint preset) and
`agent-doctest` are consumed via `file:` paths into a local callback-box
checkout. **Those paths are environment-specific** — adjust the `file:` entries
in `package.json` to wherever callback-box is checked out. Once callback-box is
published (or vendored as a submodule), these should become normal version or
submodule-relative dependencies.

## Type strictness

`tsconfig.json` extends `@ianbicking/personal-vibe-check/tsconfig.base.json`
(`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
…). Keep `pnpm typecheck` clean.

The lint preset (ESLint 9 flat config, oxlint, madge, prettier) is adopted; see
`eslint.config.mjs` for the rules this project turns off and why.

## Running the server locally

The server runs offline with no Cloudflare account, no login and no API key:

```bash
pnpm build      # the client bundle the Worker serves
pnpm preview    # wrangler dev
```

Two variables in `.dev.vars` (gitignored, never deployed) make that possible:

- `DEV_IDENTITY` stands in for a Cloudflare Access-verified user. It is only
  honoured while Access is **unconfigured** — set `ACCESS_TEAM_DOMAIN` and
  `ACCESS_AUD` and it is ignored entirely, so it cannot open a bypass in a real
  deployment. `test/access.doctest.md` asserts exactly that.
- `DEV_FAKE_LLM` swaps AI Gateway for a stand-in that emits well-formed protocol
  output in chunks. It exercises the plumbing — routing, the Durable Object, the
  event log, SSE framing, the streaming parser's chunk boundaries — and is not
  meant for actually playing.

The API lives under `/api/*` and is authenticated:

```bash
curl -X POST 'localhost:8787/api/create?session=s1' -d '{"owner":{"email":"dev@localhost"}}'
curl 'localhost:8787/api/events?session=s1'                  # log from a cursor
curl -N -X POST 'localhost:8787/api/input?session=s1' -d '{"text":"hello"}'
```

The last streams Server-Sent Events: `delta` while narrative text arrives, then
`events` with the authoritative story events that were appended to the log.

## Prompt cache boundaries

Providers cache a _prefix_ of the prompt, so the assembled system message is
ordered **stable content first, volatile content last**, with a marker line
between:

    [Everything above is fixed for this character. Everything below changes as
    the game is played.]

Above it: the boilerplate, the character's identity, description and roleplay
instructions, the player's name and pronouns, and
`additionalSystemInstructions()`. Below it: the clock, the current room, the
activity (Intra's and the character's), who else is present, mystery hints, and
`volatileSystemInstructions()`.

This matters more than it looks. The clock used to sit near the top, so every
prompt was unique from its fourth line down and prefix caching never hit at all.
Ama was worst: her roster of every person and room is the largest block in any
prompt, and it carried each person's _current room_, so any NPC walking anywhere
invalidated it. Current positions moved below the boundary.

`pnpm playtest:cache` measures the result — it drives the real engine with a
scripted LLM and reports the shared prefix across Ama's prompts, so the claim
here can be re-checked after any prompt edit rather than taken on trust. Over a
game where Ama learns the player's name partway through:

|                         | across the whole game | once the name is known |
| ----------------------- | --------------------- | ---------------------- |
| name below the boundary | 30%                   | 85%                    |
| name in the base prompt | 5%                    | 85%                    |

The player's name is **deliberately in the stable half** even though it changes.
The two arrangements are identical in steady state, which is most of a game; the
difference is one prefix rebuild when the name is first set, and having it read
naturally near the character's own identity is worth that. The whole-game column
is what that one rebuild costs, not an ongoing rate.

**When editing prompts, keep the two sides separate.** Anything that can differ
between two turns of the same game belongs below the marker unless, like the
name, it settles early and you have decided the readability is worth it. Putting
genuinely per-turn content above silently costs the cache. Ordering is
deliberately the mechanism rather than explicit cache-control breakpoints,
because it works with automatic prefix caching on every provider and survives an
OpenAI-compatible proxy, which cannot express per-provider cache markers.

Changing prompt text changes the cassette keys, so re-record after edits:
`pnpm playtest:record`.
