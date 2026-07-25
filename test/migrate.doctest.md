# Reading older logs

The event log is the game: the world is a fold over it, a save is just the log,
and a server-side session holds one per player. That makes a rename of an entity
id a data-format change — a log that refers to `player` after the id became
`PLAYER` folds into a world where the player never moved or spoke.

`migratePlayerId` fixes that up on load. It only rewrites the fields that carry
an entity id; prose is left alone, so a description that happens to mention a
player is untouched.

```ts setup
import { migratePlayerId } from "../lib/game/migrate.js";
import type { StoryEventType } from "../lib/types.js";

function event(overrides: Partial<StoryEventType>): StoryEventType {
  return {
    id: "player",
    roomId: "Intake",
    totalTime: 0,
    changes: {},
    actions: [],
    ...overrides,
  };
}
```

The event's own id, and the keys of the change set it carries:

```ts
const migrated = migratePlayerId([
  event({ changes: { player: { before: { name: "You" }, after: { name: "Ada" } } } }),
])[0]!;
[migrated.id, Object.keys(migrated.changes).join(",")].join(" ");
=> PLAYER PLAYER
```

The change itself is untouched — only the entity it is filed under moves:

```ts continue
JSON.stringify(migrated.changes.PLAYER);
=> {"before":{"name":"You"},"after":{"name":"Ada"}}
```

Speakers and their addressees, on both kinds of attributed action:

```ts
const actions = migratePlayerId([
  event({
    actions: [
      { type: "dialog", id: "player", toId: "Ama", text: "hello" },
      { type: "dialog", id: "Ama", toId: "player", text: "hi" },
      { type: "actionAttempt", id: "player", attempt: "open door", success: true, minutes: 1 },
    ],
  }),
])[0]!.actions;
actions.map((a) => ("toId" in a ? `${a.id}->${a.toId}` : a.id)).join(" ");
=> PLAYER->Ama Ama->PLAYER PLAYER
```

A description has no speaker, so there is nothing to rewrite — and its text is
left exactly as recorded even when it names the old id:

```ts
const described = migratePlayerId([
  event({ id: "narrator", actions: [{ type: "description", text: "the player waits" }] }),
])[0]!;
JSON.stringify(described.actions[0]);
=> {"type":"description","text":"the player waits"}
```

Trigger keys are entity ids too:

```ts
const triggered = migratePlayerId([
  event({ id: "Ama", triggers: { player: "Ama looked at you", Marta: "..." } }),
])[0]!;
Object.keys(triggered.triggers!).join(",");
=> PLAYER,Marta
```

Already-migrated logs pass through unchanged, so this is safe to run on every
load:

```ts
const current = event({ id: "PLAYER", changes: { PLAYER: { before: {}, after: {} } } });
const again = migratePlayerId([current])[0]!;
[again.id, Object.keys(again.changes)[0]].join(" ");
=> PLAYER PLAYER
```
