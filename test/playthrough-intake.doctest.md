# Intake playthrough (recorded)

This drives the real engine through Ama's intake conversation and checks it
reaches the right state — name captured, profession recorded, the age and
disassociation beats delivered, intake completed. The LLM replies come from a
**cassette** recorded once against a Haiku-level model (`playtest/cassettes/`),
replayed here deterministically: real model behavior, no live call, no flakiness.

The run is seeded so the schedule (and therefore every prompt, and therefore
every cassette lookup) reproduces exactly. Re-record with `pnpm playtest:record`
if the prompts or the scenario change.

The setup launches the game and plays the scripted intake lines; the checks below
assert the state it left the world in.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { replayChat } from "../playtest/recorded-chat.js";
import { installSeededRandom } from "../playtest/seed.js";
import { INTAKE } from "../playtest/scenarios.js";

installSeededRandom(INTAKE.seed);
const model = new Model(entities, { chat: replayChat(INTAKE.cassette) });

async function settle() {
  while (model.runningSignal.value) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

model.checkLaunch();
await settle();
for (const input of INTAKE.inputs) {
  await model.sendText(input);
  await settle();
}

const player = model.world.entities.PLAYER;
const ama = model.world.entities.Ama;
```

Ama learned the player's name, and recorded the pronouns they gave:

```ts
[player.name, player.pronouns].join(" / ");
=> Pat Quill / he/him
```

She used to infer the pronouns from the name instead, and the name here was
chosen to make that impossible. Guessing gender from a name misgenders the
player in their own game; asking costs one line of dialogue from a character
whose entire job is filling in forms.

…and their profession:

```ts
player.profession;
=> data analyst
```

Intake is complete: Ama covered every required beat and flipped out of the
"intro" personality into "prime":

```ts
ama.personality;
=> prime

[ama.knowsPlayerName, ama.knowsPlayerProfession, ama.sharedDisassociation, ama.sharedPlayerAge].join(" ");
=> true true true true
```

Completing intake unlocked the way out — the Intake room now has an exit to the
Foyer:

```ts
model.world.getRoom("Intake")!.exits.some((e) => e.roomId === "Foyer");
=> true
```
