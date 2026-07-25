import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Model } from "../lib/game/model";
import { entities } from "../lib/game/gameobjs";
import { haikuChat } from "./haiku-chat";
import { recordingChat } from "./recorded-chat";
import { installSeededRandom } from "./seed";
import { SCENARIOS, type Scenario } from "./scenarios";

// Record cassettes for the playtest scenarios by driving the engine with a real
// Haiku-level model and caching every LLM reply to git. Runs seeded so the
// cassette is reproducible on replay.
//   pnpm playtest:record            # record any scenario with a missing/partial cassette
//   pnpm playtest:record intake     # record just the named scenario(s)

async function settle(model: Model) {
  while (model.runningSignal.value) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function record(scenario: Scenario) {
  console.log(`\n=== recording "${scenario.name}" -> ${scenario.cassette} ===`);
  mkdirSync(dirname(scenario.cassette), { recursive: true });
  const restore = installSeededRandom(scenario.seed);
  const model = new Model(entities, {
    chat: recordingChat(
      scenario.cassette,
      haikuChat({ onCall: ({ title }) => console.error(`  [rec:${title}]`) })
    ),
  });
  model.checkLaunch();
  await settle(model);
  for (const input of scenario.inputs) {
    console.log(`> ${input}`);
    await model.sendText(input);
    await settle(model);
  }
  restore();

  const player = model.world.entities.player;
  const ama = model.world.entities.Ama;
  console.log(
    "final state:",
    JSON.stringify(
      {
        events: model.updates.value.length,
        playerName: player.name,
        playerPronouns: player.pronouns,
        playerProfession: player.profession,
        playerRoom: player.inside,
        amaPersonality: ama.personality,
        knowsPlayerName: ama.knowsPlayerName,
        knowsPlayerProfession: ama.knowsPlayerProfession,
        sharedDisassociation: ama.sharedDisassociation,
        sharedPlayerAge: ama.sharedPlayerAge,
      },
      null,
      2
    )
  );
}

async function main() {
  const filter = process.argv.slice(2);
  const chosen = filter.length
    ? SCENARIOS.filter((s) => filter.includes(s.name))
    : SCENARIOS;
  for (const scenario of chosen) {
    await record(scenario);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
