# Signing in with Google

Cloudflare Access was standing in for auth, and it is the wrong shape for a
public game: an allowlist, billed per seat, sized for employees. This is the
same job done by the app — an OIDC authorization-code flow ending in a session
cookie the Worker signs itself.

The seam it plugs into already existed. `authenticate()` answers with a verified
email and every server-side name derives from it, so the change is which source
vouches for the email.

```ts setup
import {
  completeGoogleLogin,
  emailFromIdToken,
  googleConfig,
  safeNext,
  seal,
  startGoogleLogin,
  unseal,
  verifyGoogleSession,
  SESSION_COOKIE,
  STATE_COOKIE,
} from "../worker/googleauth.js";
import { authMode, authenticate } from "../worker/access.js";

const config = {
  clientId: "client-123.apps.googleusercontent.com",
  clientSecret: "secret",
  cookieSecret: "a-long-random-string",
};

// Pull a named cookie's value out of a response's Set-Cookie headers.
function cookieFrom(response, name) {
  for (const value of response.headers.getSetCookie()) {
    if (value.startsWith(`${name}=`)) {
      return value.slice(name.length + 1).split(";")[0];
    }
  }
  return null;
}

function withCookie(url, name, value) {
  return new Request(url, { headers: { Cookie: `${name}=${value}` } });
}
```

## A deployment says which source it uses

Access and Google answer the same question, so a deployment configured for both
hasn't decided. Access wins, because it is the more restrictive of the two and
resolving a misconfiguration by opening the gate is the wrong direction.

```ts
const google = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s", SESSION_SECRET: "k" };
[
  authMode({}),
  authMode({ DEV_IDENTITY: "me@example.com" }),
  authMode(google),
  authMode({ ...google, ACCESS_TEAM_DOMAIN: "https://t.cloudflareaccess.com", ACCESS_AUD: "aud" }),
].join(" ");
=> none dev google access
```

`googleConfig` needs all three or it is not configured — a client id with no
signing key would mint cookies anyone could forge:

``` continue
[
  googleConfig(google) !== null,
  googleConfig({ ...google, SESSION_SECRET: "" }) === null,
  googleConfig({ GOOGLE_CLIENT_ID: "id" }) === null,
].join(" ");
=> true true true
```

## The development bypass stays unreachable

`DEV_IDENTITY` exists so the server can be exercised offline. It was already
unreachable when Access was configured; it has to stay unreachable now that
there is a second real source, or a leftover development variable becomes a
back door next to a working front one.

``` continue
const auth = await authenticate(new Request("https://example.com/api/x"), {
  ...google,
  DEV_IDENTITY: "sneaky@example.com",
});
[auth.ok, auth.ok ? auth.email : auth.response.status].join(" ");
=> false 401
```

## A session cookie cannot be edited

The cookie carries an email and an expiry, neither of them secret. What the
signature buys is that the browser cannot change either one.

```ts
const token = await seal({ email: "player@example.com", exp: Date.now() + 60_000 }, config.cookieSecret);
const request = withCookie("https://example.com/", SESSION_COOKIE, token);
await verifyGoogleSession(request, config);
=> player@example.com
```

Signed with a different key, or edited, it is refused:

``` continue
const forged = await seal({ email: "admin@example.com", exp: Date.now() + 60_000 }, "not-the-secret");
const tampered = token.slice(0, -4) + "AAAA";
[
  await verifyGoogleSession(withCookie("https://example.com/", SESSION_COOKIE, forged), config),
  await verifyGoogleSession(withCookie("https://example.com/", SESSION_COOKIE, tampered), config),
  await verifyGoogleSession(new Request("https://example.com/"), config),
].map(String).join(" ");
=> null null null
```

Expiry is enforced inside `unseal` rather than left to each caller, so a caller
that forgets to check it doesn't end up holding a permanent cookie:

``` continue
const stale = await seal({ email: "player@example.com", exp: Date.now() - 1 }, config.cookieSecret);
await unseal(stale, config.cookieSecret);
=> null
```

## The login leg

The browser goes to Google with PKCE, and the state cookie carries what the
callback will need to check.

```ts
const login = await startGoogleLogin(
  new Request("https://example.com/auth/login?next=%2Fsomewhere"),
  config,
);
const target = new URL(login.headers.get("Location"));
[
  login.status,
  target.origin + target.pathname,
  target.searchParams.get("scope"),
  target.searchParams.get("code_challenge_method"),
  target.searchParams.get("redirect_uri"),
].join(" | ");
=> 302 | https://accounts.google.com/o/oauth2/v2/auth | openid email | S256 | https://example.com/auth/callback
```

The verifier itself never leaves the server, and never reaches Google — only its
hash does. That is the point of PKCE: an intercepted code is useless without it.

``` continue
const state = await unseal(cookieFrom(login, STATE_COOKIE), config.cookieSecret);
[
  target.searchParams.get("state") === state.nonce,
  target.toString().includes(state.verifier),
  state.next,
].join(" ");
=> true false /somewhere
```

## Where a login can send you afterwards

`next` is attacker-controllable, so only same-site paths are honoured. Without
this the sign-in URL is an open redirector — a link on your own domain that
lands on someone else's, which is a phishing primitive.

```ts
["/game", "/a?b=c", "https://evil.example/", "//evil.example/", "", null]
  .map((n) => safeNext(n))
  .join(" ");
=> /game /a?b=c / / / /
```

## The callback

Given a code and a matching state, the flow exchanges it, checks the ID token
and sets the session cookie. The exchange and the key set are injected here, so
this runs with no network.

```ts setup
// A Google ID token, signed with a throwaway key so the real verification path
// runs rather than being stubbed out.
const pair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
const getJwks = async () => [{ kid: "k1", kty: "RSA", n: pub.n, e: pub.e }];

function b64url(bytes) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function idToken(claims) {
  const encode = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const body = `${encode({ alg: "RS256", kid: "k1" })}.${encode(claims)}`;
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    pair.privateKey,
    new TextEncoder().encode(body),
  );
  return `${body}.${b64url(sig)}`;
}

const goodClaims = {
  iss: "https://accounts.google.com",
  aud: "client-123.apps.googleusercontent.com",
  exp: Math.floor(Date.now() / 1000) + 3600,
  email: "player@example.com",
  email_verified: true,
};

// Drive the callback with a state cookie the login leg would have set.
async function callback(claims, { state, param } = {}) {
  const nonce = "nonce-abc";
  const sealed = await seal(
    { nonce, verifier: "verifier-xyz", next: "/", exp: Date.now() + 60_000 },
    config.cookieSecret,
  );
  const url = `https://example.com/auth/callback?code=the-code&state=${param ?? nonce}`;
  const request = new Request(url, {
    headers: { Cookie: `${STATE_COOKIE}=${state ?? sealed}` },
  });
  return completeGoogleLogin(request, config, {
    exchange: async () => ({ id_token: await idToken(claims) }),
    getJwks,
  });
}
```

```ts
const done = await callback(goodClaims);
const session = await unseal(cookieFrom(done, SESSION_COOKIE), config.cookieSecret);
[done.status, done.headers.get("Location"), session.email].join(" ");
=> 302 / player@example.com
```

The cookie is `HttpOnly` and `SameSite=Lax` — script must not be able to read
it, and `Strict` would withhold it on the very navigation that arrives back from
Google:

``` continue
const set = done.headers.getSetCookie().find((c) => c.startsWith(SESSION_COOKIE));
[set.includes("HttpOnly"), set.includes("SameSite=Lax"), set.includes("Secure")].join(" ");
=> true true true
```

### What the callback refuses

An unverified address is refused as hard as a bad signature. A Google account
can carry an address it hasn't proven, and treating one as an identity would let
someone claim an email they don't control.

```ts
const claims = (extra) => ({ ...goodClaims, ...extra });
const refusals = await Promise.all([
  callback(claims({ email_verified: false })),
  callback(claims({ aud: "someone-elses-client-id" })),
  callback(claims({ iss: "https://evil.example" })),
  callback(claims({ exp: Math.floor(Date.now() / 1000) - 3600 })),
  callback(goodClaims, { param: "wrong-nonce" }),
  callback(goodClaims, { state: "not-a-sealed-cookie" }),
]);
refusals.map((r) => r.status).join(" ");
=> 400 400 400 400 400 400
```

None of them sets a session cookie:

``` continue
refusals.map((r) => String(cookieFrom(r, SESSION_COOKIE))).join(" ");
=> null null null null null null
```

An `aud` for a different client is worth its own line, because it is the check
that stops a token minted for another application from signing someone in here:

``` continue
await emailFromIdToken(await idToken(claims({ aud: "other" })), config, getJwks);
=> null
```

And the honest control: the same machinery accepts a good token.

``` continue
await emailFromIdToken(await idToken(goodClaims), config, getJwks);
=> player@example.com
```

## What Google said, rather than a guess about it

The token exchange reported every failure as "could not reach Google", which
covers a wrong client secret, a redirect URI the console doesn't have, a stale
code and an actual network problem — four different fixes behind one sentence.
It sent the first person to hit it looking at their network.

Google names the problem in the body, and the name is the diagnosis.

```ts
const refused = await completeGoogleLogin(
  new Request(`https://example.com/auth/callback?code=c&state=nonce-abc`, {
    headers: { Cookie: `${STATE_COOKIE}=${await seal({ nonce: "nonce-abc", verifier: "v", next: "/", exp: Date.now() + 60_000 }, config.cookieSecret)}` },
  }),
  config,
  { exchange: async () => ({ error: "invalid_client" }) },
);
await refused.text();
=> Sign-in failed: Google refused the sign-in (invalid_client)
```

Only the code is shown. The description and the body are not ours to display,
and one of them quotes the request back.
