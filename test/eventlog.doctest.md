# The session log on Durable Object storage

A session's event log is stored one event per key, ordered by a zero-padded
index. It used to be a single value rewritten on every append, which is wrong
in two ways for something that only ever grows: every turn re-serialized and
re-wrote the whole history, and the whole history had to keep fitting inside one
storage value.

The index arithmetic, the batching and the migration off the old scheme are the
parts most likely to be subtly wrong, so `SessionLog` takes a narrow storage
interface and is tested here against a plain Map that behaves the way Durable
Object storage does — `list` ordered lexicographically by key, filtered by
`prefix` and `start`.

```ts setup
import { SessionLog, eventKey } from "../worker/eventlog.js";
import type { LogStorage } from "../worker/eventlog.js";
import type { StoryEventType } from "../lib/types.js";

class FakeStorage implements LogStorage {
  map = new Map<string, unknown>();
  puts = 0;

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async put(entries: Record<string, unknown>): Promise<void> {
    this.puts++;
    if (Object.keys(entries).length > 128) {
      throw new Error("storage takes at most 128 pairs per put");
    }
    for (const [key, value] of Object.entries(entries)) this.map.set(key, value);
  }
  async delete(key: string): Promise<boolean> {
    return this.map.delete(key);
  }
  async list<T>(options: { prefix?: string; start?: string }) {
    const keys = [...this.map.keys()].sort();
    const out = new Map<string, T>();
    for (const key of keys) {
      if (options.prefix !== undefined && !key.startsWith(options.prefix)) continue;
      if (options.start !== undefined && key < options.start) continue;
      out.set(key, this.map.get(key) as T);
    }
    return out;
  }
}

// Only the fields that identify an event matter here.
const event = (id: string): StoryEventType => ({
  id,
  roomId: "Intake",
  totalTime: 0,
  changes: {},
  actions: [],
});

const ids = (events: StoryEventType[]) => events.map((e) => e.id).join(",");
```

Appending and reading back, across separate appends:

```ts
const storage = new FakeStorage();
const log = new SessionLog(storage);
await log.append([event("a"), event("b")]);
await log.append([event("c")]);
[ids(await log.read()), await log.count()].join(" / ");
=> a,b,c / 3
```

An empty append is a no-op rather than a write:

```ts continue
const before = storage.puts;
await log.append([]);
[storage.puts - before, await log.count()].join(" / ");
=> 0 / 3
```

Reading from a cursor gives the client only what it is missing — this is what a
reconnecting tab does, so it doesn't pull the whole game back:

```ts continue
// Past the end reads as empty, not as an error.
[ids(await log.read(1)), (await log.read(3)).length].join(" | ");
=> b,c | 0
```

## Ordering survives the tenth and hundredth event

Keys are zero-padded because storage orders them as strings: unpadded, `event:10`
would sort before `event:9` and the log would silently come back scrambled.

```ts
[eventKey(0), eventKey(9), eventKey(10), eventKey(12345678)].join(" ");
=> event:00000000 event:00000009 event:00000010 event:12345678
```

```ts
const storage = new FakeStorage();
const log = new SessionLog(storage);
await log.append(Array.from({ length: 12 }, (_, i) => event(`e${i}`)));
ids(await log.read()).split(",").slice(8, 12).join(",");
=> e8,e9,e10,e11
```

## Batching

Storage accepts at most 128 pairs per put, and one slot goes to the count — so a
300-event append is three puts, and the fake above throws if that arithmetic is
off by one.

```ts
const storage = new FakeStorage();
const log = new SessionLog(storage);
await log.append(Array.from({ length: 300 }, (_, i) => event(`e${i}`)));
[storage.puts, await log.count(), ids(await log.read()).split(",")[299]].join(" / ");
=> 3 / 300 / e299
```

The count lands in the same put as the events it counts, so a partial write
leaves the two consistent rather than claiming events that aren't there:

```ts continue
const stored = await storage.list<unknown>({ prefix: "event:" });
[stored.size, await storage.get("logCount")].join(" / ");
=> 300 / 300
```

## Migrating a session written by the old scheme

A session stored under the single `log` key is moved across the first time it is
touched, and the old key is dropped so it doesn't happen twice.

```ts
const storage = new FakeStorage();
storage.map.set("log", [event("old1"), event("old2")]);
const log = new SessionLog(storage);
[ids(await log.read()), await log.count(), storage.map.has("log")].join(" / ");
=> old1,old2 / 2 / false
```

Appending after a migration continues the same log rather than starting over:

```ts continue
await log.append([event("new1")]);
ids(await log.read());
=> old1,old2,new1
```

A session that was already migrated pays one `get` of an absent key:

```ts continue
const before = storage.puts;
await log.read();
storage.puts - before;
=> 0
```
