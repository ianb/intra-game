# The story middle: commitments, alternatives, and saved consequences

These exercise the real tag interpreter and event fold. They do not claim that
a live model will notice a player's intention or write a good scene.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { applyTag } from "../lib/game/tags.js";
import { parseTags } from "../lib/parsetags.js";
import { mysteryTriggers, catchUpMysteries } from "../lib/game/mysteries.js";
import type { StoryEventType } from "../lib/types.js";

function fresh() { return new Model(entities, { chat: async () => "" }).world; }
function reply(world, text, actor = "Ama") {
  const event: StoryEventType = { id: actor, roomId: world.entities.PLAYER.inside,
    totalTime: 0, changes: {}, actions: [] };
  const complaints: string[] = [];
  for (const tag of parseTags(text)) applyTag(tag, event, {
    world, entityId: actor, roomId: event.roomId, complaints,
  });
  return { event, complaints };
}
function fold(world, event) {
  const rewards = world.allMysteries().flatMap(q => q.onStoryEvent(event) ?? []);
  world.applyStoryEvent(event);
  for (const reward of rewards) world.applyStoryEvent(reward);
  return rewards;
}
const resolve = (id: string) => `<resolveMystery id="${id}">Completed.</resolveMystery>`;
```

## Reading the briefing exposes a choice; it does not release deliveries

```ts
const w = fresh();
const briefing = reply(w, resolve("Why_Woken")).event;
fold(w, briefing);
for (const event of mysteryTriggers(w, briefing)) w.applyStoryEvent(event);
[w.entities.PLAYER.queueDisturbed, w.entities.Resume_Deliveries.state,
 w.entities.Henrys_Appointment.state, w.entities.Cafe_Valve.state].join(" ");
=> true revealed veiled veiled
```

The old queueDisturbed flag is discovery, not permission. Neither a guessed
resolution nor a direct state assignment can skip the recorded steps.

``` continue
const premature = reply(w, resolve("Resume_Deliveries") + '<set attr="Resume_Deliveries.state">solved</set>');
[premature.complaints.length, Object.keys(premature.event.changes).length].join(" ");
=> 2 0
```

Inspecting alone still does not restart it.

``` continue
fold(w, reply(w, '<set attr="Resume_Deliveries.evidence">true</set>', 'Archivist').event);
[w.entities.Resume_Deliveries.state, w.entities.Henrys_Appointment.state].join(" ");
=> revealed veiled
```

The explicit performance and resolution can arrive in one model response.

``` continue
const resume = reply(w, '<set attr="Resume_Deliveries.performed">true</set>' + resolve('Resume_Deliveries'));
fold(w, resume.event);
for (const event of mysteryTriggers(w, resume.event)) w.applyStoryEvent(event);
[resume.complaints.length, w.entities.Resume_Deliveries.state,
 w.entities.Henrys_Appointment.state, w.entities.Cafe_Valve.state].join(" ");
=> 0 solved revealed revealed
```

## Work earns trust once, and the consequence survives replay

```ts
const w = fresh();
w.entities.Garden_Repair.state = 'revealed';
const result = reply(w, '<set attr="Garden_Repair.agreement">true</set><set attr="Garden_Repair.performed">true</set>' + resolve('Garden_Repair'), 'Greg');
const rewards = fold(w, result.event);
[w.entities.Greg.confidence, rewards.length, w.entities.Garden_Repair.onStoryEvent(result.event).length].join(' ');
=> 2 1 0
```

``` continue
const loaded = fresh();
loaded.applyStoryEvent(result.event);
for (const event of rewards) loaded.applyStoryEvent(event);
[loaded.entities.Greg.confidence, loaded.entities.Garden_Repair.rewarded].join(' ');
=> 2 true
```

## Safe alternatives do not require grinding trust

Models cannot grant Greg's or Frida's quest-earned confidence through flattery.

```ts
const w = fresh();
const result = reply(w, '<set attr="Greg.confidence">2</set><set attr="Frida.confidence">2</set>');
[result.complaints.length, Object.keys(result.event.changes).length].join(' ');
=> 2 0
```

```ts
const w = fresh();
w.entities.Cafe_Valve.state = 'revealed';
const unsafe = reply(w, '<set attr="Cafe_Valve.evidence">true</set><set attr="Cafe_Valve.performed">true</set>' + resolve('Cafe_Valve'), 'Greg');
[unsafe.complaints.length, unsafe.event.changes.Cafe_Valve.after.state ?? 'unsolved'].join(' ');
=> 1 unsolved
```

Lana's cold-meal agreement is sufficient without Greg's confidence.

``` continue
const cold = reply(w, '<set attr="Cafe_Valve.evidence">true</set><set attr="Cafe_Valve.agreement">true</set><set attr="Cafe_Valve.performed">true</set>' + resolve('Cafe_Valve'), 'Greg');
fold(w, cold.event);
[cold.complaints.length, w.entities.Cafe_Valve.state, w.entities.Greg.confidence].join(' ');
=> 0 solved 0
```

## Appointment needs the evidence and the people

```ts
const w = fresh();
w.entities.Henrys_Appointment.state = 'revealed';
const text = '<set attr="Henrys_Appointment.evidence">true</set><set attr="Henrys_Appointment.agreement">true</set><set attr="Henrys_Appointment.performed">true</set>' + resolve('Henrys_Appointment');
reply(w, text).complaints.length;
=> 1
```

``` continue
w.entities.PLAYER.inside = 'Waiting_Room';
w.entities.Henry.inside = 'Waiting_Room';
const held = reply(w, text);
fold(w, held.event);
[held.complaints.length, w.entities.Henrys_Appointment.state, w.entities.Frida.confidence].join(' ');
=> 0 solved 0
```

## Guest access preserves Marta's title and opens the real door

```ts
const w = fresh();
w.entities.Martas_Guest.state = 'revealed';
const text = '<set attr="Martas_Guest.agreement">true</set><set attr="Martas_Guest.performed">true</set>' + resolve('Martas_Guest');
reply(w, text, 'Marta').complaints.length;
=> 1
```

``` continue
fold(w, reply(w, '<set attr="Marta.confidence">2</set>', 'Marta').event);
const accepted = reply(w, text, 'Marta');
const rewards = fold(w, accepted.event);
[w.entities.PLAYER.starCitizen, w.entities.Star_Citizen.state,
 w.getRoom('Hallway').exits.find(e => e.roomId === 'Reflection_Chamber').sealed ?? false].join(' ');
=> false solved false
```

``` continue
w.entities.Martas_Guest.onStoryEvent(accepted.event).length;
=> 0
```

## Old checkpoints acquire opportunities without auto-solving them

```ts
const w = fresh();
w.entities.Ink_And_Echo.state = 'solved';
w.entities.Why_Woken.state = 'solved';
w.entities.PLAYER.knowsAboutTour = true;
for (const event of catchUpMysteries(w)) w.applyStoryEvent(event);
[w.entities.Garden_Repair.state, w.entities.Fridas_Copies.state,
 w.entities.Resume_Deliveries.state, w.entities.Martas_Guest.state,
 w.entities.Cafe_Valve.state].join(' ');
=> revealed available revealed revealed veiled
```

## Hints expose both the destination and the means

```ts
const w = fresh();
w.entities.Fridas_Copies.state = 'revealed';
const prompt = JSON.stringify(w.entities.Frida.assemblePrompt({}));
[prompt.includes('treatment correspondence'), prompt.includes('Frida.confidence'),
 prompt.includes('dated originals')].join(' ');
=> true true true
```
