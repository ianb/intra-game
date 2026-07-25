# Versioning what gets stored

Three places hold a game — the browser's live log, browser save slots, and a
Durable Object's session log — and until now none of them recorded what shape
they were written in. A future change to the stored shape would have had nothing
to go on but the contents.

This is deliberately only about *shape*. What an event means — a renamed entity,
a retired tag — is a separate problem, solved per change in
`lib/game/migrate.ts`, and a counter can't help with it.

```ts setup
import { read, stamp, STORAGE_VERSION } from "../lib/storage.js";
```

## Stamped on the way out, checked on the way in

```ts
const stored = stamp(["an event"]);
[stored.version === STORAGE_VERSION, JSON.stringify(stored.value)].join(" ");
=> true ["an event"]
```

``` continue
const result = read<string[]>(stored);
[result.ok, result.ok && result.value[0]].join(" ");
=> true an event
```

## Anything unstamped is version 0

Which is everything written before this existed — the payload is the value
itself, with no envelope around it:

```ts
const result = read<string[]>(["an old event"]);
[result.ok, result.from, result.ok && result.value[0]].join(" ");
=> true 0 an old event
```

Migrations run one step per version, so a store that changes shape three times
writes three small functions instead of one that knows every combination:

```ts
const steps: number[] = [];
const migrated = read<string>("payload", (value, from) => {
  steps.push(from);
  return `${value}+v${from + 1}`;
});
[steps.join(","), migrated.ok && migrated.value].join(" | ");
=> 0 | payload+v1
```

One step here, 0 → 1, because `STORAGE_VERSION` is 1. Bumping it makes this run
two steps, which is the point — the count is asserted, so the version can't move
without someone deciding what the new step does:

``` continue
[steps.length, STORAGE_VERSION].join(" ");
=> 1 1
```

## A payload from the future is refused, not guessed at

The case that actually happens to people: a tab left open, the game redeployed
under it, and now the stored game is a shape this build has never seen. There is
no way to know what a future shape means, and half-understanding a save is worse
than declining it:

```ts
const result = read<string[]>({ version: STORAGE_VERSION + 99, value: "???" });
result.ok;
=> false
```

``` continue
!result.ok && result.reason.includes("newer version of the game");
=> true
```

Note which way this errs. Refusing a readable save costs someone one confusing
message; accepting an unreadable one costs them the game, and they find out
later.
