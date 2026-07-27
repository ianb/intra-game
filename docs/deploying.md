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
steps 4–6 put it on your own domain, decide who is allowed to play, and let the
server hold the model key instead of the browser.

---

## What you are creating

| Thing                         | Where                              | Why                                                              |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| A Worker                      | Workers & Pages                    | Serves the game and the API                                      |
| A Workers Build connection    | The Worker → Settings → Build      | Deploys on push                                                  |
| An AI Gateway                 | AI → AI Gateway                    | The model calls go through it; gives you billing limits and logs |
| An API token                  | My Profile → API Tokens            | Lets the Worker call the gateway                                 |
| A provider key                | The gateway → provider keys        | The gateway routes to Anthropic rather than being it             |
| A custom domain (optional)    | The Worker → Domains & Routes      | Serves the game somewhere you chose                              |
| A way to know who a player is | Google OAuth, or Zero Trust Access | Server-side play is keyed to a verified email                    |

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

**Why `--prod`, and why the tooling is optional.** `agent-doctest` and
`@ianbicking/personal-vibe-check` are `file:` paths into a callback-box checkout
that exists only on your machine, and the builder has no way to resolve them.
`--prod` keeps them out of the build, and everything the build itself needs —
esbuild, tsx, tailwindcss, postcss — is in `dependencies` for exactly that
reason. Don't move those without changing the build command too.

`--prod` alone was not enough, which is worth knowing before changing it back.
As plain devDependencies pnpm still tried to _link_ them under `--prod` and
failed with `ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND`, so this build command would
have failed the first deploy. They are `optionalDependencies` now, which pnpm
skips when they can't be resolved. Verified by running the exact build command
in a directory where those paths don't exist. (When callback-box is published,
all of this can go back to a plain `pnpm install`.)

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

Dashboard → **AI** → **AI Gateway** → **Create Gateway**. **The name matters** —
a gateway is addressed by it:
`https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/compat/chat/completions`.
Note what you call it, along with your **Account ID** (also in the URL of any
dashboard page, and on the right of the Workers overview).

Set both as plain variables on the Worker — neither is a secret:

Worker → **Settings** → **Variables and Secrets** → add

| Name                  | Value                                              |
| --------------------- | -------------------------------------------------- |
| `CF_ACCOUNT_ID`       | your account id                                    |
| `CF_GATEWAY_ID`       | the gateway's name; omit only if it is `default`   |
| `GATEWAY_MODEL`       | optional; defaults to `anthropic/claude-haiku-4-5` |
| `GATEWAY_FLASH_MODEL` | optional; a cheaper model for mechanical prompts   |

The two model vars are in `provider/model` form. The game runs several prompts
per turn and they aren't the same kind of work: a character deciding what to say is the game,
while working out that "look at the statues" was an examine rather than speech
is bookkeeping. A prompt declares which **tier** it needs and these two vars
decide what fulfils it; leaving `GATEWAY_FLASH_MODEL` unset means one model does
everything, which is the old behaviour.

Setting it costs nothing in cache terms, which is the surprising part. A prefix
cache is keyed by (model, exact prefix), and `pnpm playtest:cache` measures that
a character prompt and any player-side prompt share **19 characters** — they
were never in the same cache entry, so moving one can't cost the other a hit.
Better still, the prompts worth moving are the ones with the least to lose:
character prompts reuse 86% of their text once the player is named, while
`player input` reuses 8%, since it carries the room, the people and the exits.

Which prompts _should_ be on the small tier is a measurement, not a guess —
`pnpm evals --model <big> --flash <small>` scores a pair. See
[evals/README.md](../evals/README.md).

### The provider key

The gateway routes to a provider; it isn't one. A model id of
`anthropic/claude-haiku-4-5` means Anthropic still has to be paid, and
`cf-aig-authorization` only gets a request as far as Cloudflare. Two ways to
supply the rest, and the Worker handles both:

- **BYOK** — store an Anthropic key in the gateway (your gateway → provider
  keys, backed by Secrets Store). Requests then carry no provider header at all,
  which is what the Worker sends by default.
- **The player's own key** — passed through as `Authorization`, so a player pays
  for their own play while the gateway still logs it against your account.

With neither, calls fail at the provider rather than at Cloudflare, so the error
names Anthropic and not the gateway.

## 3. Create the API token

Quickest route is the **Create an AI Gateway authentication token** button on
the gateway's own settings page, which pre-fills the permissions. Otherwise **My
Profile** → **API Tokens** → **Create Token** → **Custom token**.

| Setting           | Value                                              |
| ----------------- | -------------------------------------------------- |
| Permissions       | `Account` → `AI Gateway` → `Run`                   |
| Account resources | Include → your account only                        |
| TTL               | Set one if you want; you'll rotate it the same way |

`AI Gateway` → `Run` is what `cf-aig-authorization` is checked against. The
dashboard's own button also adds `Workers AI` → `Read`/`Edit`, which is harmless
but only needed for `workers-ai/...` models.

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

## 4. Point your domain at it (optional, but do it before Access)

Skip this and the game lives at `intra-game.<subdomain>.workers.dev`, which
works fine. If you want your own domain, do it **before** step 5: an Access
application is bound to a hostname, so setting Access up first means redoing it.

The domain has to be on Cloudflare — a Worker custom domain can only be added
for a zone in the same account.

1. **Websites** → **Add a site**, enter the domain, and change the nameservers
   at your registrar to the two Cloudflare gives you. Activation is usually
   minutes but can take longer.
2. Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain**.
   Add the apex and `www` if you want both; Cloudflare creates the DNS records
   and the certificate.

**The workers.dev URL keeps working**, which matters for step 5: an Access
application covering only your domain leaves that hostname uncovered. The Worker
itself still fails closed there — it verifies the Access JWT on every path once
configured, so an uncovered hostname gets 401 rather than a free game — but a
bare 401 is a worse door than a login page. Either add both hostnames to the one
Access application, or turn the workers.dev route off under **Domains &
Routes**.

## 5. Choose who can play

Two ways to know who a player is, and they are alternatives rather than layers.
Both end at the same place — `authenticate()` returns a verified email, and
every server-side name is derived from it — so this decides the shape of the
deployment, not the shape of the code.

|              | **Google sign-in**                   | **Cloudflare Access**                      |
| ------------ | ------------------------------------ | ------------------------------------------ |
| Who gets in  | anyone with a Google account         | the emails you list                        |
| What's gated | `/api/*` only; the game stays public | every path                                 |
| Cost         | none                                 | per seat above Zero Trust's free allowance |
| Set up       | §5a                                  | §5b                                        |

If both are configured Access wins, because it is the more restrictive and
resolving a misconfiguration by opening a gate is the wrong direction.

### 5a. Google sign-in (a public game)

The game itself stays public: anyone can load it and play in their own browser
on their own model key, no account needed. Signing in is what buys server-side
play — games that outlive the browser, on your model budget.

In the Google Cloud console, **APIs & Services** → **Credentials** → **Create
OAuth client ID** → **Web application**:

| Field                         | Value                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Authorized JavaScript origins | leave empty — this is a server-side code flow           |
| Authorized redirect URIs      | `https://<your-domain>/auth/callback`                   |
|                               | `http://localhost:8787/auth/callback` for local testing |

Then **Google Auth Platform** → **Audience**: scopes `openid` and `email` only,
and click **Publish app**. While the app is in Testing only listed test users
can sign in, capped at 100, which quietly recreates the allowlist you are trying
to avoid. Publishing with only those two scopes needs no verification review.

Three variables on the Worker:

| Name                   | Kind      | Value                                                                                           |
| ---------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | plain var | it appears in a redirect URL; not a secret                                                      |
| `GOOGLE_CLIENT_SECRET` | secret    | `npx wrangler secret put GOOGLE_CLIENT_SECRET`                                                  |
| `SESSION_SECRET`       | secret    | **not from Google** — the key this Worker signs its own cookies with. `openssl rand -base64 32` |

Rotating `SESSION_SECRET` signs everybody out, which is the lever to pull if a
session is ever suspect.

What the Worker does with them: an authorization-code flow with PKCE, a state
cookie carrying the verifier and a nonce, Google's ID token verified against
their published keys with `iss`, `aud` and `email_verified` all checked, and a
session cookie it signs itself — HttpOnly, Secure, SameSite=Lax. No access token
is kept and no refresh token is asked for. `test/googleauth.doctest.md` covers
the refusals, including the one that is easy to skip: an unverified address is
rejected as hard as a bad signature.

### 5b. Put Cloudflare Access in front

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

> **Leave the Path field empty**, so Access covers the whole app. If you scope
> it to `/api/*` the Worker will still refuse to serve the site — it gates every
> path once `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set — but visitors get a
> bare 401 instead of a login page, which is a worse experience than the one
> line of config it takes to avoid.

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

### Who can get in

Access is an allowlist, so with the policy above — include: your email — nobody
else can reach the game, and there is no self-serve signup to find. That is the
default and probably what you want.

It is a policy choice rather than a property of the code, though. An include
rule of **Everyone**, or a one-time PIN to any address, would let strangers in
without any change to the app: they would each get a verified email, their own
session index, and their own games, because every server-side name is derived
from that email. Two things to weigh before doing it — Zero Trust bills by seat
above its free allowance (check the current limit), and every server session
runs on _your_ AI Gateway token unless the player supplies their own key.

## 6. Play on the server

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
[testing.md](./testing.md#running-the-server-locally) and
[.dev.vars.example](../.dev.vars.example).

You can also point a local Worker at the **real** AI Gateway — credentials in
`.dev.vars`, `DEV_FAKE_LLM` commented out — which is the cheapest way to
confirm this half of the setup before anything is deployed. Step 2 is the only
part of this guide it needs.
