# Why were you woken?

The why-woken mystery (lib/game/content/mysteries/why-woken) chains off two
others: it lands on the task list when where-and-when resolves, and its easiest
route opens when Ink and Echo resolves — settling Ama's errand makes her trust
the player, which is what lets her remember Sentra's message. Both rewards are
engine-made events, so a model narrates them but cannot forget them.

```ts setup
import { entities } from "../lib/game/content/index.js";
import { Model } from "../lib/game/model.js";
import { mysteryTriggers } from "../lib/game/mysteries.js";

const model = new Model(entities, { chat: async () => "" });
const world = model.world;
```

## Available from the first turn

Greg will mention the pod and Ama will deflect whenever asked; the game just
doesn't raise the subject. Available never reaches the task list.

```ts
[world.entities.Why_Woken.state, world.todos.length].join(" ");
=> available 0
```

## Revealed by the year

The first use of a `solved` trigger: the moment where-and-when resolves, "why
now" becomes a question, and the narrator announces it.

```ts
const solveWhereAndWhen = {
  id: "Archivist",
  totalTime: 0,
  roomId: "Archive_Console",
  changes: {
    whereAndWhen: { before: { state: "revealed" }, after: { state: "solved" } },
  },
  actions: [],
};
world.applyStoryEvent(solveWhereAndWhen);
const fired = mysteryTriggers(world, solveWhereAndWhen);
[fired.length, fired[0].id, fired[0].changes.Why_Woken.after.state].join(" ");
=> 1 narrator revealed
```

``` continue
world.applyStoryEvent(fired[0]);
world.todos.map((todo) => todo.title).join(", ");
=> When is this, and where are you?, Why were you woken?
```

## Trust is the Ink and Echo reward

Resolving Ink and Echo sets `Ama.trustsPlayer` and her attitude toward the
player, in one engine event.

```ts
const solveInk = {
  id: "Marta",
  totalTime: 0,
  roomId: "Yellow_Room",
  changes: {
    Ink_And_Echo: { before: { state: "revealed" }, after: { state: "solved" } },
  },
  actions: [],
};
const reward = world.entities.Ink_And_Echo.onStoryEvent(solveInk);
[reward.length, reward[0].changes.Ama.after.trustsPlayer].join(" ");
=> 1 true
```

``` continue
world.applyStoryEvent(reward[0]);
[world.entities.Ama.trustsPlayer, world.entities.Ama.attitudes.PLAYER].join(" | ");
=> true | Settled the Ink and Echo matter for me. Someone I can hand things to.
```

It fires once — an undone and replayed solve does not stack a second reward:

``` continue
world.entities.Ink_And_Echo.onStoryEvent(solveInk).length;
=> 0
```

## The meters reach prompts

Ama's hint branches on `Ama.trustsPlayer` and gates the handover on
`PLAYER.knowsAboutMessage`, so both are declared as meters and injected live
into every briefed character's prompt.

```ts
const prompt = world.entities.Greg.assemblePrompt({});
const system = String(prompt.messages[0].content);
system.includes(
  "Current values: Ama.trustsPlayer = true, PLAYER.knowsAboutMessage = false",
);
=> true
```

## Resolving lights the fuse

Whichever route surfaced the stuck delivery, resolving the mystery sets
`PLAYER.queueDisturbed`. Nothing reads it yet; the planned reset act does.

```ts
const solveWhyWoken = {
  id: "narrator",
  totalTime: 0,
  roomId: "Quarters_Yours",
  changes: {
    Why_Woken: { before: { state: "revealed" }, after: { state: "solved" } },
  },
  actions: [],
};
const fuse = world.entities.Why_Woken.onStoryEvent(solveWhyWoken);
[fuse.length, fuse[0].changes.PLAYER.after.queueDisturbed].join(" ");
=> 1 true
```

``` continue
world.applyStoryEvent(fuse[0]);
[
  world.entities.PLAYER.queueDisturbed,
  world.entities.Why_Woken.onStoryEvent(solveWhyWoken).length,
].join(" ");
=> true 0
```
