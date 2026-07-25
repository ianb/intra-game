# The Access gate fails closed

`/api/*` is gated by Cloudflare Access. The Worker verifies the forwarded
assertion rather than trusting the header, so a request that reaches the origin
directly can't impersonate a player.

Every one of these cases must be a rejection. That's the whole property worth
testing here: the gate should never admit anyone on doubt.

```ts setup
import { verifyAccessAssertion, accessConfig } from "../worker/access.js";

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
