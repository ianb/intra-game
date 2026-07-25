# The list of a player's games

Sessions were always addressable — a game's Durable Object is named
`${email}:${sessionId}`, so any number can exist per player — but a DO namespace
cannot be enumerated. `idFromName` is one-way, and there is no "give me every
session for this email", so a player had exactly one game: whichever id their
browser happened to be holding, lost the moment it was cleared.

So one small Durable Object per verified identity remembers which sessions
exist. It holds no game state, which is what makes it cheap to be wrong about:
losing this loses the *menu*, and a session it forgot is still there under its
own name.

```ts setup
import { SessionIndex, MAX_SESSIONS } from "../worker/sessionindex.js";
import type { IndexStorage } from "../worker/sessionindex.js";

class FakeStorage implements IndexStorage {
  map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async put(entries: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) this.map.set(key, value);
  }
}

const at = (day: string) => new Date(`2026-07-${day}T12:00:00Z`);
const titles = (sessions: { title: string }[]) =>
  sessions.map((s) => s.title).join(", ");
```

## Starting games

A new player has no games, and games are named for them if they don't name one:

```ts
const index = new SessionIndex(new FakeStorage());
await index.register("a", undefined, at("20"));
await index.register("b", "The one with the ficus", at("21"));
titles(await index.list());
=> Game 1, The one with the ficus
```

``` continue
JSON.stringify(await index.list().then((s) => s[0]));
=> {"id":"a","title":"Game 1","created":"2026-07-20"}
```

## Registering is idempotent

This is called every time a client joins a session, not only when one is
created — which is what keeps the list honest. A session started before any of
this existed, or one whose id lives in a bookmark, gets listed the first time it
is used rather than staying invisible forever:

```ts
const index = new SessionIndex(new FakeStorage());
await index.register("a", "Kept");
await index.register("a", "Ignored, it already exists");
titles(await index.list());
=> Kept
```

## Renaming and forgetting

```ts
const index = new SessionIndex(new FakeStorage());
await index.register("a", "Before");
await index.rename("a", "After");
titles(await index.list());
=> After
```

Renaming something that isn't there fails rather than inventing it, since the
only way to get here is a stale client:

``` continue
[await index.rename("nope", "x"), await index.rename("a", "  ")].map(String).join(" ");
=> null null
```

Forgetting reports whether there was anything to forget, so the caller can tell
a deletion from a no-op:

``` continue
[await index.forget("a"), await index.forget("a"), (await index.list()).length].join(" ");
=> true false 0
```

Note what `forget` does *not* do: it doesn't delete the game. The log lives in a
different Durable Object that this one has no way to reach, so wiping it is the
router's job — and the router forgets first, because a game that is orphaned is
recoverable in a way that a listed game with no storage behind it isn't.

## There is a ceiling

Not for safety — a player's own games can't hurt anyone — but because listing
fans out one subrequest per game, and an unbounded list would eventually make
the menu the slowest thing in the app:

```ts
const index = new SessionIndex(new FakeStorage());
for (let i = 0; i < MAX_SESSIONS; i++) await index.register(`s${i}`);
const refused = await index.register("one-too-many").then(() => "", (e) => String(e));
[(await index.list()).length, refused.includes("delete one")].join(" ");
=> 50 true
```
