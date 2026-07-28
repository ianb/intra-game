# When the composer will take a turn

There used to be two engines. The browser could play a whole game on the
player's own OpenRouter key, and the server could play one on its own — two sets
of rules, and a key in the settings panel that meant something different
depending on which mode the tab happened to be in.

There is one engine now, on the server, and the browser is a view of it. So the
only question left is whether this tab has a game there.

```ts setup
import { playable } from "../app/session.js";

const signedOut = { mode: "google", email: null, loginUrl: "/auth/login" };
const signedIn = { mode: "google", email: "player@example.com", loginUrl: "/auth/login" };
const say = (r) => `${r.ok ? "yes" : "no"}${r.why ? ": " + r.why : ""}`;
```

## Signed in, with a game

```ts
say(playable({ auth: signedIn, session: "abc" }));
=> yes
```

## Signed out

The composer is not where anyone should learn this — a signed-out visitor gets
the sign-in screen instead of the game — but it stays correct for the moment
between a session expiring and the page noticing.

```ts
say(playable({ auth: signedOut, session: null }));
=> no: Sign in to play.
```

Signing in is offered where it would help, and not otherwise:

``` continue
[
  playable({ auth: signedOut, session: null }).loginUrl,
  playable({ auth: signedIn, session: null }).loginUrl,
].map(String).join(" ");
=> /auth/login null
```

## Signed in, no game

Starting one is automatic, so this means it failed — which is worth saying
rather than showing a composer that swallows what you type.

```ts
say(playable({ auth: signedIn, session: null }));
=> no: No game on the server yet — try reloading.
```

## Before the answer arrives

`/api/auth` is a fetch, so `auth` is null for the first moment of the page. That
must not read as "signed out": it resolves a beat later, and a composer that
refuses and then changes its mind is worse than one that accepts a keystroke
early.

```ts
playable({ auth: null, session: null }).ok;
=> true
```
