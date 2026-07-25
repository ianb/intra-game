# Knowing when a recording has gone stale

Two recorded things drift out of date as the game changes: the **cassettes** the
deterministic tests replay, and the **numbers** the evals record. They drift
differently and want opposite treatment, so they're pinned together here.

```ts setup
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cassetteMissMessage, promptKey, replayChat } from "../playtest/recorded-chat.js";
import { promptFingerprint } from "../playtest/fingerprint.js";
import { fingerprintNote } from "../evals/report.js";
import type { ChatType } from "../lib/types.js";

const ask = (content: string, title = "prompt Ama"): ChatType => ({
  meta: { title },
  messages: [{ role: "system", content }],
});

// A cassette on disk with one recorded reply.
const dir = mkdtempSync(join(tmpdir(), "cassette-"));
const path = join(dir, "intake.json");
writeFileSync(path, JSON.stringify({
  [promptKey(ask("you are Ama"))]: { title: "prompt Ama", response: "<dialog>Hello.</dialog>" },
}));

// Run something with console.error captured, since that's where a stale
// cassette announces itself.
async function withErrors<T>(fn: () => Promise<T>): Promise<[T, string[]]> {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(" ")); };
  try {
    return [await fn(), errors];
  } finally {
    console.error = original;
  }
}
```

## A cassette hit is silent

The recorded reply comes back, and nothing is said:

```ts
const chat = replayChat(path);
const [reply, errors] = await withErrors(() => chat(ask("you are Ama")));
[reply, errors.length].join(" | ");
=> <dialog>Hello.</dialog> | 0
```

## A miss says so

This is the whole point. The key is a hash of the prompt, so editing a prompt
misses every entry, and a miss returns `""` — which parses to no game action.
The test then fails on game *state* ("the player has no name", "Ama never
finished intake"), which reads as the engine being broken rather than the
fixture being old.

The reply is unchanged — control flow stays exactly as it was — but there's now
a message pointing at the actual problem:

```ts
const chat = replayChat(path);
const [reply, errors] = await withErrors(() => chat(ask("you are Ama, and you keep a task list")));
[JSON.stringify(reply), errors.length].join(" | ");
=> "" | 1
```

``` continue
[errors[0]!.includes("stale"), errors[0]!.includes("pnpm playtest:record intake")].join(" ");
=> true true
```

It reports once per replay, not once per miss — a stale cassette misses every
prompt in the run, and twelve copies of the same message is just noise:

```ts
const chat = replayChat(path);
const [, errors] = await withErrors(async () => {
  await chat(ask("one"));
  await chat(ask("two"));
  await chat(ask("three"));
});
errors.length;
=> 1
```

Nothing having matched *yet* is the difference between "stale" and "drifted", so
the message distinguishes them. A miss after some hits is ordinary variance; a
miss with no hits at all means the recording no longer applies:

```ts
[
  cassetteMissMessage("playtest/cassettes/intake.json", ask("x"), 12, 0).includes("stale"),
  cassetteMissMessage("playtest/cassettes/intake.json", ask("x"), 12, 7).includes("stale"),
].join(" ");
=> true false
```

An absent cassette isn't stale, it's missing, and the fix is different:

```ts
cassetteMissMessage("playtest/cassettes/intake.json", ask("x"), 0, 0);
=> No cassette at playtest/cassettes/intake.json — record it with: pnpm playtest:record intake
```

## Eval results record what they measured

The other direction. Nothing here is invalidated automatically — the numbers
stay, because a number measured against an old prompt is still a fact about that
prompt. What was missing is any way to tell that's what happened.

The fingerprint is taken by running the engine against a scripted LLM and
hashing the prompts it assembles, so it needs no cassette (which would be stale
at exactly the moment this is wanted) and no network:

```ts
const [a, b] = [await promptFingerprint(), await promptFingerprint()];
[a === b, a.length].join(" ");
=> true 12
```

A day's results say which prompts they were measured against:

```ts
const run = (fingerprint?: string) => ({
  model: "m", backend: "cli",
  scenarios: [{ scenario: "intake", passed: 1, total: 1, ms: 0, events: 0,
    dropped: [], repaired: [], transcript: [], checks: [],
    ...(fingerprint ? { promptFingerprint: fingerprint } : {}) }],
});
fingerprintNote({ date: "2026-07-25", runs: [run("abc123")] });
=> Prompts `abc123`.
```

Mixed fingerprints are normal rather than alarming — re-running one scenario
after a prompt edit is exactly what merging results supports — but two rows
measured against different prompts aren't comparable, and nothing else in the
table would say so:

``` continue
fingerprintNote({ date: "2026-07-25", runs: [run("abc123"), run("def456")] })
  .includes("aren't directly comparable");
=> true
```

Results recorded before any of this existed say that, rather than claiming a
provenance they don't have:

``` continue
fingerprintNote({ date: "2026-07-24", runs: [run()] });
=> Recorded before prompt fingerprints, so what was measured isn't known.
```
