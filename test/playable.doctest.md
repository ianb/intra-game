# When the composer will take a turn

Typing was always accepted and the failure came afterwards, as an error about an
OpenRouter API key — which spends a first-time player's opening minute on a
message about someone else's API. The composer now asks first, and says which of
the two missing things it is.

The rule has to fail in the *permissive* direction when it isn't sure. A wrong
"you can't play" locks out someone who can, and they have no way to argue with
it.

```ts setup
import { playable } from "../app/session.js";

const google = { mode: "google", email: null, loginUrl: "/auth/login" };
const signedIn = { mode: "google", email: "player@example.com", loginUrl: "/auth/login" };
const local = { mode: "none", email: null, loginUrl: null };
const say = (r) => `${r.ok ? "yes" : "no"}${r.why ? ": " + r.why : ""}`;
```

## Local play needs the player's own key

A signed-out visitor no longer reaches the composer at all — signing in is the
only way into a deployment that has a door, and this used to be where they
learned that. It still matters for the case that remains: signed in, but the
server game failed to start, so the tab fell back to local play.

```ts
say(playable({ auth: google, session: null, hasKey: false }));
=> no: Sign in to play, or add your own model key in settings.
```

With a key, it doesn't matter who you are — the turn runs here, on your account.

``` continue
[
  playable({ auth: google, session: null, hasKey: true }).ok,
  playable({ auth: null, session: null, hasKey: true }).ok,
].join(" ");
=> true true
```

Where signing in isn't offered at all, saying so would be a dead end rather than
an instruction:

``` continue
say(playable({ auth: local, session: null, hasKey: false }));
=> no: Add your own model key in settings to play.
```

## Server play needs an identity

The key stops mattering — the server has its own — and the question becomes who
is spending it.

```ts
[
  say(playable({ auth: google, session: "abc", hasKey: true })),
  say(playable({ auth: signedIn, session: "abc", hasKey: false })),
].join(" | ");
=> no: Sign in to play this game. | yes
```

A deployment with no identity source, and the local development identity, both
play without signing in — there is nobody to be:

``` continue
[
  playable({ auth: local, session: "abc", hasKey: false }).ok,
  playable({ auth: { mode: "dev", email: "dev@localhost", loginUrl: null }, session: "abc", hasKey: false }).ok,
].join(" ");
=> true true
```

## Before the answer arrives

`/api/auth` is a fetch, so for the first moment of the page `auth` is null. That
must not read as "signed out" and lock the composer, because it resolves to
"signed in" a moment later and the player would have watched the game refuse
them for no reason.

```ts
[
  playable({ auth: null, session: "abc", hasKey: false }).ok,
  playable({ auth: null, session: null, hasKey: true }).ok,
].join(" ");
=> true true
```

The one case still refused while unknown is local play with no key, and that is
not a guess — no key is no key, whoever you turn out to be.

``` continue
playable({ auth: null, session: null, hasKey: false }).ok;
=> false
```
