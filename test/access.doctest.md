# The Access gate fails closed

`/api/*` is gated by Cloudflare Access. The Worker verifies the forwarded
assertion rather than trusting the header, so a request that reaches the origin
directly can't impersonate a player.

Every one of these cases must be a rejection. That's the whole property worth
testing here: the gate should never admit anyone on doubt.

```ts setup
import { verifyAccessAssertion, accessConfig, authenticate } from "../worker/access.js";
import worker, { type Env } from "../worker/index.js";

const config = { teamDomain: "https://team.cloudflareaccess.com", aud: "aud-tag" };

// A key set that would verify nothing; the negative paths never reach it.
const noKeys = async () => [];

function withToken(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers["Cf-Access-Jwt-Assertion"] = token;
  return new Request("https://game.example/api/events", { headers });
}

const b64 = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString("base64url");

async function reject(request: Request, getJwks = noKeys) {
  const result = await verifyAccessAssertion({ request, config, getJwks });
  return result.ok ? "ADMITTED" : result.reason;
}

// A stand-in Env whose asset binding records whether it was reached.
let served = 0;
const env = (over: Record<string, string> = {}) =>
  ({
    ASSETS: { fetch: async () => { served++; return new Response("the game"); } },
    ...over,
  }) as unknown as Env;

const accessOn = {
  ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
  ACCESS_AUD: "aud-tag",
};
```

## Unconfigured deployments have no gate to open

With no team domain or aud, there is no configuration to verify against. The
caller turns this into a 404 rather than a 401, so an unconfigured deployment
doesn't advertise a gated surface:

```ts
accessConfig({});
=> null

accessConfig({ ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com", ACCESS_AUD: "aud-tag" }) !== null;
=> true
```

## Missing and malformed assertions

```ts
await reject(withToken());
=> no-assertion

await reject(withToken(""));
=> no-assertion

await reject(withToken("not-a-jwt"));
=> invalid

await reject(withToken("only.two"));
=> invalid
```

## An `alg: "none"` token is refused

The classic JWT downgrade: a token that asks to be trusted without a signature.
The algorithm is pinned to RS256 rather than read from the token, so this never
reaches verification:

```ts
const unsigned = [
  b64({ alg: "none", kid: "k1" }),
  b64({ aud: "aud-tag", iss: config.teamDomain, exp: 9999999999, email: "someone@example.com" }),
  "",
].join(".");
await reject(withToken(unsigned));
=> invalid
```

Claiming RS256 without a matching key is refused too — a well-formed token is
still worthless without a signature that verifies:

```ts
const unverifiable = [
  b64({ alg: "RS256", kid: "k1" }),
  b64({ aud: "aud-tag", iss: config.teamDomain, exp: 9999999999, email: "someone@example.com" }),
  "c2lnbmF0dXJl",
].join(".");
await reject(withToken(unverifiable));
=> invalid
```

## An unreachable key set fails closed

If the JWKS can't be fetched the gate refuses rather than assuming the token was
fine:

```ts
await reject(withToken("a.b.c"), async () => null);
=> invalid
```

That case reports `jwks-unavailable` once the token itself parses, so the reason
is distinguishable in logs:

```ts
const wellFormed = [
  b64({ alg: "RS256", kid: "k1" }),
  b64({ aud: "aud-tag", iss: config.teamDomain, exp: 9999999999, email: "someone@example.com" }),
  "c2ln",
].join(".");
await reject(withToken(wellFormed), async () => null);
=> jwks-unavailable
```

## The development bypass cannot open a hole in production

Local development needs a way in without a Cloudflare account, so an explicit
`DEV_IDENTITY` stands in for a verified user. That is only safe if it cannot
apply to a real deployment — so it is gated on Access being *unconfigured*, not
on a separate "is production" flag that could be set wrong.

```ts
const anonymous = new Request("https://game.example/api/events");

// No Access configured, no dev identity: nothing to verify against.
(await authenticate(anonymous, {})).ok;
=> false

// No Access configured, dev identity set: local development.
const dev = await authenticate(anonymous, { DEV_IDENTITY: "dev@localhost" });
dev.ok && dev.email;
=> dev@localhost
```

The property that matters: once Access *is* configured, `DEV_IDENTITY` is
ignored entirely. A deployment that gates on Access cannot be bypassed even if a
dev variable leaks into its environment.

``` continue
const configured = await authenticate(anonymous, {
  ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
  ACCESS_AUD: "aud-tag",
  DEV_IDENTITY: "attacker@example.com",
});
configured.ok;
=> false

configured.ok ? "ADMITTED" : configured.response.status;
=> 401
```

## The site is gated too, not just the API

The Worker serves `/api/*` itself and hands everything else — the game, the
transcript, `/evals/` — to static assets. Access normally stops a request before
the Worker sees it, so gating assets here is usually redundant. *Usually*: only
if the Access application covers the whole hostname. Scoped to `/api/*` by
accident, the API stays locked and the site goes public, with no error anywhere.

So the Worker decides for itself. Configuring Access is the statement "this is
private", and it then applies to every path.

```ts
// No Access: this is the local-play deployment. The engine runs in the
// player's browser on their own key, so there is nothing here to protect.
const open = await worker.fetch(new Request("https://game.example/"), env());
[open.status, served].join(" / ");
=> 200 / 1
```

With Access configured and no assertion, the page is refused rather than
served — and the assets binding is never reached, so nothing leaks:

``` continue
const beforeGated = served;
const gated = await worker.fetch(new Request("https://game.example/"), env(accessOn));
[gated.status, served - beforeGated].join(" / ");
=> 401 / 0
```

That covers the deep links too, which is where this would have bitten:

``` continue
const beforeEvals = served;
const evals = await worker.fetch(new Request("https://game.example/evals/"), env(accessOn));
[evals.status, served - beforeEvals].join(" / ");
=> 401 / 0
```

Local development is unaffected, because `DEV_IDENTITY` only applies while
Access is unconfigured — the same rule that stops it being a production bypass:

``` continue
const beforeDev = served;
const dev = await worker.fetch(
  new Request("https://game.example/"),
  env({ DEV_IDENTITY: "dev@localhost" }),
);
[dev.status, served - beforeDev].join(" / ");
=> 200 / 1
```
