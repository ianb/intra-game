# Installing

Three ways to run this, in increasing order of what they need. Pick the lowest
one that does what you want.

| You want to                                   | Read                   |
| --------------------------------------------- | ---------------------- |
| Play the game                                 | [1](#1-play-it)        |
| Work on the engine, prompts or content        | [2](#2-develop-it)     |
| Work on the server (sessions, identity, cost) | [3](#3-run-the-server) |

Deploying is separate: see [docs/deploying.md](./docs/deploying.md).

## Prerequisites

- **Node 22+** and **pnpm 10.33+** (`packageManager` in package.json pins the
  pnpm version; corepack will honour it).
- An **[OpenRouter](https://openrouter.ai/) account** to play. Free models work.
- The **`claude` CLI** on PATH, only for `pnpm playtest`, `pnpm evals` and
  `pnpm checkpoint`. Nothing else needs it.

No Cloudflare account is needed for anything on this page.

## Before you start: two tools that may be missing

`package.json` has two `file:` dependencies pointing outside the repo:

```
"@ianbicking/personal-vibe-check": "file:../../../workspace/callback-box/personal-vibe-check"
"agent-doctest":                   "file:../../../workspace/callback-box/agent-doctest"
```

They are the lint/tsconfig preset and the doctest runner, and they are **not on
npm yet**. They are `optionalDependencies`, so `pnpm install` succeeds whether
or not you have that checkout — it just skips them.

What that means for you:

- **Just running the game?** Nothing to do. Section 1 works as written.
- **Working on it?** You need them, or `pnpm test` and `pnpm lint` fail with
  "cannot find module". Clone
  [callback-box](https://github.com/ianb/callback-box) and edit the two `file:`
  paths to match where you put it.

They are optional rather than dev dependencies for a reason worth knowing: as
plain devDependencies, pnpm tried to link them even under `--prod`, so a missing
checkout failed the install outright — including on the Cloudflare builder,
which would have failed the first deploy. Tracked in [TODO.md](./TODO.md); it
stops mattering when they are published.

## 1. Play it

```bash
pnpm install        # or --prod, see above
pnpm dev            # http://localhost:8787 — client and server together
```

Open Settings (⚙) and connect to OpenRouter. The engine runs in your browser
against your own key; nothing is sent anywhere else. Games are saved in browser
storage.

Two things worth knowing on the way in:

- `?checkpoint=briefed` starts partway into the game instead of at the opening.
  `pnpm checkpoint --list` shows what's recorded. Your game in progress is saved
  first, so following one of these can't lose anything.
- Settings also has an optional second model for the mechanical prompts
  (interpreting what you typed, resolving what you looked at). Leave it unset to
  use one model for everything.

## 2. Develop it

```bash
pnpm install
pnpm test           # doctests: executable markdown under test/
pnpm typecheck
pnpm lint
pnpm build
```

All four should be clean on a fresh checkout. If `pnpm test` or `pnpm lint` fail
with "cannot find module", it's the missing callback-box tools above, not your
changes.

The loops you'll actually use are in [docs/testing.md](./docs/testing.md).
Briefly:

```bash
pnpm playtest "Hello?" "go to the foyer"   # drive the real engine, real model
pnpm playtest --from briefed -i            # ...starting from a saved state
pnpm playtest:cache                        # what the prompts cost in cache terms
pnpm evals                                 # score whether a model can run the game
```

`pnpm playtest` and `pnpm evals` make **live model calls** through the `claude`
CLI. They are slow, non-deterministic and never run in CI. The deterministic
suite is `pnpm test`.

**If you change a prompt**, the recorded cassettes stop matching and
`pnpm test` fails on game state rather than saying so. Re-record:

```bash
rm playtest/cassettes/intake.json && pnpm playtest:record intake
```

## 3. Run the server

The server (sessions, identity, per-session logs, cost records) runs locally
with no Cloudflare account:

```bash
pnpm build && pnpm preview      # wrangler dev
```

`.dev.vars` supplies the variables. Copy the template and read it — it
documents every mode:

```bash
cp .dev.vars.example .dev.vars
```

The default is fully offline: a stand-in identity and a stand-in LLM, enough to
exercise routing, Durable Objects, the event log, SSE streaming and the usage
records without an account, a key or a network.

To use a real model, set `OPENROUTER_API_KEY` and **comment out
`DEV_FAKE_LLM`**. It is checked first, so leaving it set means the stand-in
answers and nothing reaches the provider — a game that works perfectly and costs
nothing, which is not an obvious failure.

To exercise the streaming and cost paths without spending anything:

```bash
pnpm fakeprovider      # localhost, speaks the same protocol
# then in .dev.vars: OPENROUTER_BASE_URL=http://127.0.0.1:8799/v1/chat/completions
```

## Sharp edges

Recorded so they aren't rediscovered:

- **`pnpm test` or `pnpm lint` can't find a module** → the callback-box tools
  above aren't installed.
- **`pnpm test` fails on game state after a prompt edit** → stale cassette. It
  now prints what to run; older failures looked like a broken engine.
- **The server works but costs nothing** → `DEV_FAKE_LLM` is still set.
- **Every local request 401s** → `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` are set in
  `.dev.vars`. A browser on localhost has no Access assertion, and `DEV_IDENTITY`
  is deliberately ignored the moment Access is configured.
- **`pnpm build` wipes `dist/`**, which breaks a running `wrangler dev`'s asset
  manifest. Restart `pnpm preview` after a build.
- **Node 22 is assumed.** `.npmrc` sets `node-linker=hoisted`, which the `file:`
  dependencies need in order to resolve their peers from this repo.
