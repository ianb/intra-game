# What a character witnessed

The world is one append-only stream of story events, but no character sees all
of it. `history.ts` answers "what does *this* character know?" — filtering the
stream to the events they were present for and rendering them as the chat
messages that go into their prompt. This is what lets an NPC be prompted with
only what they could plausibly have witnessed.

(The `«blankline»` markers below stand for a literal blank line in the expected
output.)

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { updatesSeenBy, historyForEntity } from "../lib/game/history.js";
import type { StoryEventType } from "../lib/types.js";

// A fresh headless world. June, Doug and Lana start in the Tranquil Pool;
// Marta starts elsewhere, in the Hollow Atrium.
function worldWith(updates: StoryEventType[]) {
  const model = new Model(entities, { chat: async () => "" });
  model.updates.value = updates;
  return model.world;
}

function dialog(roomId: string, id: string, text: string, toId?: string): StoryEventType {
  return {
    id, roomId, totalTime: 0, changes: {},
    actions: [{ type: "dialog", id, toId, text }],
  };
}
```

## Presence decides visibility

June says something by the pool. June and Doug are both there, so both witness
it — Marta, over in the Hollow Atrium, does not:

```ts
const world = worldWith([
  dialog("Tranquil_Pool", "June", "The water is very still today.", "Doug"),
]);
[
  updatesSeenBy(world.getPerson("Doug")!).length,
  updatesSeenBy(world.getPerson("Marta")!).length,
].join(" / ");
=> 1 / 0
```

For Doug it renders as a scene heading plus the dialog, addressed to him:

``` continue
historyForEntity(world.getPerson("Doug")!)[0]!.content;
=> [The following events occur in room Tranquil_Pool]
«blankline»
<dialog character="June" to="Doug">
The water is very still today.
</dialog>
```

Marta, who wasn't there, has no history at all — she can't be prompted with
something she never heard:

``` continue
historyForEntity(world.getPerson("Marta")!);
=> []
```

## The player is the "user" turn

The story is fed to the LLM as a conversation: the player's own events become
`user` messages, everyone else's become `assistant` messages.

Emoji are also stripped out of dialog. The model is allowed to emit them, but if
it *sees* them in the history it uses them more and more each turn, so they are
removed to avoid that feedback loop:

```ts
const world = worldWith([
  dialog("Intake", "player", "Hello there \u{1F600} friend ☀"),
]);
const message = historyForEntity(world.getPerson("player")!)[0]!;
message.role;
=> user

message.content.includes("\u{1F600}") || message.content.includes("☀");
=> false
```

## Comings and goings

Movement in the character's room is narrated inline, so an NPC knows who just
walked in. Descriptions carry their duration when they have one:

```ts
const world = worldWith([
  {
    id: "narrator", roomId: "Tranquil_Pool", totalTime: 0,
    changes: { Marta: { before: { inside: "Hollow_Atrium" }, after: { inside: "Tranquil_Pool" } } },
    actions: [{ type: "description", text: "Marta strides in.", minutes: 5 }],
  },
]);
historyForEntity(world.getPerson("Doug")!)[0]!.content;
=> [The following events occur in room Tranquil_Pool]
«blankline»
[Marta arrives from Hollow_Atrium]
«blankline»
<description minutes="5">Marta strides in.</description>
```

## Consecutive turns are folded

Chat APIs expect alternating roles, so two events from the same side collapse
into a single message rather than two `assistant` turns in a row:

```ts
const world = worldWith([
  dialog("Tranquil_Pool", "June", "One."),
  dialog("Tranquil_Pool", "June", "Two."),
]);
const history = historyForEntity(world.getPerson("Doug")!);
history.length;
=> 1

history[0]!.content;
=> [The following events occur in room Tranquil_Pool]
«blankline»
<dialog character="June">
One.
</dialog>
«blankline»
<dialog character="June">
Two.
</dialog>
```
