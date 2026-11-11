# Recovery and the surface settlement

Choices pass through the model tag interpreter. These tests cover consequences,
not whether a model will infer an ambiguous player's intention correctly.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { applyTag } from "../lib/game/tags.js";
import { parseTags } from "../lib/parsetags.js";
import { historyForEntity } from "../lib/game/history.js";
function fresh() {
  const m = new Model(entities, { chat: async () => "" });
  m.replaceLog([{ id: 'narrator', roomId: 'Reflection_Chamber', totalTime: 0, actions: [], changes: {
    PLAYER: {before: {}, after: {inside: 'Reflection_Chamber', launched: true}},
    Frida: {before: {}, after: {inside: 'Reflection_Chamber', confidence: 2}},
    Recovery_Review: {before: {}, after: {state: 'revealed'}},
    Cafe_Valve: {before: {}, after: {state: 'solved'}},
    Henrys_Appointment: {before: {}, after: {state: 'solved'}},
    Garden_Repair: {before: {}, after: {state: 'solved'}},
  }}]);
  return m;
}
function tags(m, text, actor = 'Ama') {
  const e = {id: actor, roomId: m.world.entities.PLAYER.inside, totalTime: 0, actions: [], changes: {}};
  const complaints = [];
  for (const tag of parseTags(text)) applyTag(tag, e, {world: m.world, entityId: actor, roomId: e.roomId, complaints});
  if (!complaints.length) m.replaceLog([...m.updates.value, e]);
  return {e, complaints};
}
const choose = (m, c, actor = 'Ama', id = 'Recovery_Review') => tags(m, `<chooseMystery id="${id}" choice="${c}"/>`, actor);
function relay(m) {
  m.replaceLog([...m.updates.value, {id:'narrator', roomId:'Utility_Closet', totalTime:0, actions:[], changes: {
    PLAYER:{before:{},after:{inside:'Utility_Closet'}},
    Relay_Decision:{before:{},after:{state:'revealed'}},
  }}]);
}
```

## A notice is not treatment, and one response cannot skip the discussion

```ts
const m = fresh();
choose(m, 'confirm').complaints.length;
=> 1

choose(m, 'inspect').complaints.length;
=> 0

choose(m, 'confirm').complaints.length;
=> 1

choose(m, 'recover-frida', 'Ama').complaints.length;
=> 1
```

``` continue
tags(m, '<set attr="Recovery_Review.outcome">recovered</set><set attr="Recovery_Review.state">solved</set><set attr="Frida.memoryStart">99</set><resolveMystery id="Recovery_Review">Done</resolveMystery>').complaints.length;
=> 4
```

## A citizen may change her mind before confirmation

```ts
const m = fresh();
choose(m, 'inspect');
choose(m, 'recover-frida', 'Frida');
choose(m, 'keep-frida', 'Frida');
choose(m, 'confirm');
[m.world.entities.Recovery_Review.outcome, m.world.entities.Frida.confidence, m.world.entities.Frida.memoryStart].join(' ');
=> kept 2 0
```

## Suspending the review is an alternative to every treatment or favor

```ts
const m = fresh();
choose(m, 'inspect');
choose(m, 'pause');
[m.world.entities.Recovery_Review.state, m.world.entities.Recovery_Review.outcome, m.world.entities.Frida.confidence].join(' ');
=> solved paused 2

choose(m, 'confirm').complaints.length;
=> 1
```

## Recovery excludes old personal history but preserves the event log and repairs

```ts
const m = fresh();
tags(m, '<dialog character="Frida">You helped me with the SECRET_QUARREL.</dialog>', 'Frida');
tags(m, '<attitude toward="PLAYER">They helped me through the SECRET_QUARREL.</attitude>', 'Frida');
choose(m, 'inspect');
choose(m, 'recover-frida', 'Frida');
const before = [...m.updates.value];
choose(m, 'confirm');
const after = [...m.updates.value];
[m.world.entities.Recovery_Review.outcome, m.world.entities.Frida.confidence,
 JSON.stringify(historyForEntity(m.world.entities.Frida)).includes('SECRET_QUARREL'),
 JSON.stringify(m.updates.value).includes('SECRET_QUARREL'),
 m.world.entities.Garden_Repair.state, m.world.entities.Henrys_Appointment.state].join(' ');
=> recovered 0 false true solved solved
```

``` continue
Object.keys(m.world.entities.Frida.attitudes).length;
=> 0
```

Reload and undo use the same events. No destructive log deletion occurs.

``` continue
const loaded = fresh();
loaded.replaceLog(after);
[loaded.world.entities.Recovery_Review.outcome, loaded.world.entities.Frida.memoryStart === m.world.entities.Frida.memoryStart].join(' ');
=> recovered true

const withCuff = fresh();
withCuff.replaceLog([{id:'narrator', roomId:'Intake', totalTime:0, changes:{}, actions:[{type:'description',text:'Cuff directions'}], uiOnly:true}, ...after]);
JSON.stringify(historyForEntity(withCuff.world.entities.Frida)).includes('SECRET_QUARREL');
=> false

loaded.replaceLog(before);
[loaded.world.entities.Recovery_Review.outcome, loaded.world.entities.Frida.confidence,
 JSON.stringify(historyForEntity(loaded.world.entities.Frida)).includes('SECRET_QUARREL')].join(' ');
=> pending 2 true
```

Letters can earn trust again, without undoing the memory cutoff.

``` continue
const cutoff = m.world.entities.Frida.memoryStart;
choose(m, 'reintroduce', 'Frida');
[m.world.entities.Frida.confidence, m.world.entities.Recovery_Review.reintroduced, m.world.entities.Frida.memoryStart === cutoff].join(' ');
=> 2 true true

choose(m, 'reintroduce', 'Frida').complaints.length;
=> 1
```

## Recommendations do not operate the surface cutoff

```ts
const m = fresh();
choose(m, 'inspect'); choose(m, 'pause'); relay(m);
const r = (c, actor = 'PLAYER') => choose(m, c, actor, 'Relay_Decision');
r('release').complaints.length;
=> 1

r('contact'); r('challenge');
[m.world.entities.Relay_Decision.recommendation, m.world.entities.Relay_Decision.outcome].join(' ');
=> release pending

r('inspect');
r('release').complaints.length;
=> 1

r('restore-duty', 'Ama'); r('release');
[m.world.entities.Relay_Decision.state, m.world.entities.Relay_Decision.outcome, m.world.entities.Recovery_Review.outcome].join(' ');
=> solved release paused

r('stay').complaints.length;
=> 1
```

## Both isolation routes and the local settlement preserve the review

```ts
const m = fresh();
choose(m, 'inspect'); choose(m, 'pause'); relay(m);
const r = c => choose(m, c, 'PLAYER', 'Relay_Decision');
r('contact'); r('inspect');
r('isolate').complaints.length;
=> 1

tags(m, '<set attr="Cafe_Valve.agreement">true</set>');
r('isolate');
m.world.entities.Relay_Decision.outcome;
=> isolate
```

```ts
const m = fresh();
choose(m, 'inspect'); choose(m, 'pause'); relay(m);
choose(m, 'contact', 'PLAYER', 'Relay_Decision');
choose(m, 'inspect', 'PLAYER', 'Relay_Decision');
choose(m, 'stay', 'PLAYER', 'Relay_Decision');
[m.world.entities.Relay_Decision.outcome, m.world.entities.Henrys_Appointment.state].join(' ');
=> stay solved
```

## Action prompts know about real choices and persistent outcomes

```ts
const m = fresh();
choose(m, 'inspect'); choose(m, 'pause'); relay(m);
const prompt = JSON.stringify(m.world.entities.PLAYER.assembleActionPrompt({actionAttempt:'open the live relay channel'}));
[prompt.includes('chooseMystery'), prompt.includes('Relay_Decision'), prompt.includes('die roll cannot')].join(' ');
=> true true true
```

## Every review outcome can reach every settlement

```ts
const combinations = [];
for (const treatment of ['pause', 'keep-frida', 'recover-frida']) {
  for (const ending of ['release', 'isolate', 'stay']) {
    const m = fresh();
    choose(m, 'inspect');
    if (treatment === 'pause') choose(m, 'pause');
    else { choose(m, treatment, 'Frida'); choose(m, 'confirm'); }
    const memory = m.world.entities.Frida.memoryStart;
    const review = m.world.entities.Recovery_Review.outcome;
    relay(m);
    choose(m, 'contact', 'PLAYER', 'Relay_Decision');
    choose(m, 'inspect', 'PLAYER', 'Relay_Decision');
    if (ending === 'release') choose(m, 'restore-duty', 'Ama', 'Relay_Decision');
    if (ending === 'isolate') tags(m, '<set attr="Cafe_Valve.agreement">true</set>');
    const result = choose(m, ending, 'PLAYER', 'Relay_Decision');
    combinations.push(!result.complaints.length && m.world.entities.Relay_Decision.outcome === ending && m.world.entities.Recovery_Review.outcome === review && m.world.entities.Frida.memoryStart === memory);
  }
}
[combinations.length, combinations.every(Boolean)].join(' ');
=> 9 true
```

## Standing exemptions depend on earned cooperation and survive suspension

```ts
const m = fresh();
choose(m, 'inspect');
[choose(m, 'exempt-greg', 'Greg').complaints.length, choose(m, 'exempt-marta', 'Marta').complaints.length].join(' ');
=> 1 1

m.appendRemoteEvents([{id:'narrator', roomId:'Reflection_Chamber', totalTime:0, actions:[], changes:{
  Greg:{before:{confidence:0},after:{confidence:2}}, Marta:{before:{confidence:0},after:{confidence:2}},
}}]);
choose(m, 'exempt-greg', 'Greg'); choose(m, 'exempt-marta', 'Marta'); choose(m, 'pause');
[m.world.entities.Recovery_Review.gregExempt, m.world.entities.Recovery_Review.martaExempt, m.world.entities.Henrys_Appointment.state].join(' ');
=> true true solved
```

## Greg's earned-confidence route also permits isolation

```ts
const m = fresh();
choose(m, 'inspect'); choose(m, 'pause'); relay(m);
m.appendRemoteEvents([{id:'narrator', roomId:'Utility_Closet', totalTime:0, actions:[], changes:{Greg:{before:{confidence:0},after:{confidence:2}}}}]);
choose(m, 'contact', 'PLAYER', 'Relay_Decision');
choose(m, 'inspect', 'PLAYER', 'Relay_Decision');
choose(m, 'isolate', 'PLAYER', 'Relay_Decision');
[m.world.entities.Relay_Decision.outcome, m.world.entities.Cafe_Valve.agreement].join(' ');
=> isolate false
```
