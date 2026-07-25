# Deploying to Cloudflare

One Worker serves the whole game: Cloudflare serves the client bundle from
`dist/` directly, and `worker/index.ts` handles `/api/*`. Sessions live in
Durable Objects, one per player per session id.

Pushes to `main` deploy automatically via **Workers Builds** — Cloudflare's own
git integration, so there is no API token stored in GitHub and no Actions
workflow to maintain. The trade-off is that Workers Builds does not gate on
tests; run `pnpm test` before pushing, or add a checks-only Actions workflow
later.

Everything below is done once. Steps 1–3 get you a deployed, playable URL;
steps 4–5 are what make it _yours_ rather than open to the internet, and what
lets the server hold the model key instead of your browser.

---

## What you are creating

| Thing                      | Where                              | Why                                                                             |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| A Worker                   | Workers & Pages                    | Serves the game and the API                                                     |
| A Workers Build connection | The Worker → Settings → Build      | Deploys on push                                                                 |
| An AI Gateway              | AI → AI Gateway                    | The model calls go through it; gives you billing limits and logs                |
| An API token               | My Profile → API Tokens            | Lets the Worker call the gateway                                                |
| An Access application      | Zero Trust → Access → Applications | Makes the game yours alone, and gives the server a verified identity per player |

---

## 1. Connect the repo (Workers Builds)

Dashboard → **Workers & Pages** → **Create** → **Import a repository**, and pick
`ianb/intra-game`. When it asks for build settings, use exactly:

| Field             | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| Project name      | `intra-game` (must match `name` in `wrangler.jsonc`)  |
| Production branch | `main`                                                |
| Build command     | `pnpm install --prod --frozen-lockfile && pnpm build` |
| Deploy command    | `npx wrangler deploy`                                 |
| Root directory    | `/`                                                   |

**The `--prod` matters.** Two devDependencies (`agent-doctest` and
`@ianbicking/personal-vibe-check`) are `file:` paths into a callback-box
checkout that only exists on your machine. A plain `pnpm install` in
Cloudflare's builder would fail on them. `--prod` skips devDependencies
entirely, and everything the build itself needs — esbuild, tsx, tailwindcss,
postcss — is in `dependencies` for exactly this reason. Don't move them back
without changing the build command too. (When callback-box is published this
can all go back to a normal `pnpm install`.)

The first build deploys to `https://intra-game.<your-subdomain>.workers.dev`.
Open it: the game should load and be playable with your own OpenRouter key,
because `/api/*` isn't configured yet and the client falls back to running the
engine in the browser. That's a good checkpoint — stop here and confirm it works
before adding the server side.

> **Durable Objects.** Server-side play needs the SQLite-backed Durable Object
> this Worker declares — one per session, holding that session's event log and
> running the engine. That is what makes a session a single serialized thing:
> two turns cannot interleave and corrupt the log, and the log outlives the
> browser. If the deploy succeeds but session creation fails, whether your plan
> covers Durable Objects is the first thing to check.

## 2. Create the AI Gateway

Dashboard → **AI** → **AI Gateway** → **Create Gateway**. Any name; the game
doesn't reference it by name — it calls the account-level OpenAI-compatible
endpoint. What you need from this page is your **Account ID** (also in the URL
of any dashboard page, and on the right of the Workers overview).

Set it as a plain variable on the Worker — it isn't a secret:

Worker → **Settings** → **Variables and Secrets** → add

| Name            | Value                                              |
| --------------- | -------------------------------------------------- |
| `CF_ACCOUNT_ID` | your account id                                    |
| `GATEWAY_MODEL` | optional; defaults to `anthropic/claude-haiku-4-5` |

`GATEWAY_MODEL` is in `provider/model` form. See `lib/models.ts` for the two
tiers the game asks for and why.

## 3. Create the API token

**My Profile** → **API Tokens** → **Create Token** → **Custom token**.

| Setting           | Value                                              |
| ----------------- | -------------------------------------------------- |
| Permissions       | `Account` → `Workers AI` → `Edit`                  |
| Account resources | Include → your account only                        |
| TTL               | Set one if you want; you'll rotate it the same way |

Copy the token — it is shown once. Then, from a checkout with wrangler
authenticated:

```bash
npx wrangler secret put CF_AIG_TOKEN
```

It prompts, so the value never lands in shell history. You can also paste it
under **Settings → Variables and Secrets → Add → Secret**.

**Never put this in `wrangler.jsonc`.** That file is committed; `vars` in it are
public. Secrets are a separate store and are write-only once set — the dashboard
will show you the name, never the value.

At this point `/api/*` still returns 404, because Access isn't configured. That
is deliberate: the API fails closed rather than open. Step 4 is what turns it
on.

## 4. Put Cloudflare Access in front

This does two jobs: it keeps the game private to you, and it gives the server a
_verified_ email per request, which is what sessions are keyed by. Without it
there is no notion of who a player is.

**Zero Trust** → **Access** → **Applications** → **Add an application** →
**Self-hosted**.

| Field            | Value                                           |
| ---------------- | ----------------------------------------------- |
| Application name | `intra-game`                                    |
| Session duration | Whatever suits you — 1 month is fine for a game |
| Public hostname  | `intra-game.<your-subdomain>.workers.dev`       |
| Path             | leave empty — protect the whole app             |

Protecting the whole app rather than just `/api/*` is the simpler choice and the
right one here: the game is yours, the client bundle isn't interesting to
anyone else, and it means the browser always has the Access cookie by the time
the app makes its first API call.

Add a policy: **Allow**, with an include rule of **Emails** → your address.

Then, on the application's **Overview** tab, copy the **Application Audience
(AUD) Tag**. Your **team domain** is on Zero Trust → Settings → Custom Pages (or
visible in the login URL): `<team>.cloudflareaccess.com`.

Set both as variables on the Worker — `ACCESS_AUD` is an identifier, not a
secret, so either the dashboard or `wrangler.jsonc` works:

| Name                 | Value                         |
| -------------------- | ----------------------------- |
| `ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com` |
| `ACCESS_AUD`         | the AUD tag                   |

If you put them in `wrangler.jsonc` instead, replace the empty strings in
`vars` and push; that keeps the deployment reproducible from the repo, at the
cost of committing your team domain.

**How the Worker uses them:** it verifies the `Cf-Access-Jwt-Assertion` header —
RS256 pinned, signature checked against your team's JWKS, plus `aud`, `iss`,
`exp`, `nbf` and `iat` with clock skew. Every error path fails closed. The
verified email is what the Durable Object is named after, so one player cannot
address another's session even by guessing a session id.
`test/access.doctest.md` covers the failure modes, including that the local
`DEV_IDENTITY` bypass is unreachable the moment these two variables are set.

## 5. Play on the server

Reload the deployed URL. Open **Settings** and click **Play on the server** —
the tab reloads, creates a session, and from then on the engine runs in a
Durable Object with the model key held server-side. The event log lives on the
server, so it survives closing the tab, and it is the audit trail: everything
the model produced, in order.

To go back to running the engine in your browser, the same settings panel has
**Play in this tab instead**.

---

## Deploying from a Claude Code container

`wrangler deploy` works from a container if — and only if — it has a Cloudflare
credential. **Set it in the environment's configuration, not by pasting it into
a conversation:** anything in a message is in the transcript, and a token there
should be treated as compromised.

Add to the environment's variables:

| Name                    | Value                                               |
| ----------------------- | --------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | a token with `Account` → `Workers Scripts` → `Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | your account id                                     |

Then `pnpm deploy` works from the container. Scope the token to Workers Scripts
on the one account, and rotate it when you're done experimenting — it is a
deploy key living in an ephemeral machine.

Without it, everything except the deploy itself still works offline:

```bash
pnpm preview                          # wrangler dev, no account needed
npx wrangler deploy --dry-run --outdir /tmp/out   # validates bundle + bindings
```

The dry run resolves every binding and builds the exact bundle that would be
uploaded, so a config mistake surfaces without credentials.

## Preview builds: looking at something before it ships

`wrangler versions upload` builds and uploads a version **without** sending
traffic to it, and prints a preview URL:

```bash
pnpm build && npx wrangler versions upload
# → https://<version-prefix>-intra-game.<subdomain>.workers.dev
```

That URL is the way to be handed something specific to look at — it runs the
real worker against the real Durable Objects, and the live deployment is
untouched until `wrangler versions deploy` promotes it. It needs the same API
token as a normal deploy, so it works from a Claude Code container too (see
above).

Point it at a recorded state rather than the game's first line:

```
https://<preview-url>/?checkpoint=briefed
```

`?checkpoint=<name>` loads one of the states under `playtest/checkpoints/`,
which the build ships into `dist/checkpoints/`. It's the same mechanism as
`pnpm playtest --from briefed`, so anything reachable from the CLI is reachable
from a link. A game already in progress is saved first, so following one of
these links can't cost you a game.

Preview URLs sit behind the same Access application as the live site, since the
policy covers the whole worker.

## Rolling back

Worker → **Deployments** → pick a previous version → **Rollback**. Because the
event log lives in Durable Object storage rather than the bundle, a rollback
doesn't lose anyone's game.

Two things make that safer than it used to be. Stored data carries a version
stamp (`lib/storage.ts`): a rolled-back worker handed a session a newer one
wrote refuses to append to it rather than corrupting it, and a browser tab
holding a newer save moves it aside instead of flattening it. That's shape only
— what an event _means_ after a rename or a retired tag is a per-change fixup,
and `lib/game/migrate.ts` is where those go.

## Local development

None of the above is needed to run the server locally:

```bash
pnpm build && pnpm preview
```

`.dev.vars` (gitignored) supplies `DEV_IDENTITY` in place of an Access-verified
user and `DEV_FAKE_LLM` in place of the gateway. See
[testing.md](./testing.md#running-the-server-locally).
