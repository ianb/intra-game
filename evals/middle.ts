/** Focused live-model checks of the new middle's prompts and tag consequences.
 * Run: pnpm exec tsx evals/middle.ts
 * These are isolated conversations, not an end-to-end player playthrough.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Model } from "../lib/game/model";
import { entities } from "../lib/game/content";
import { cliChat, DEFAULT_CLI_MODEL } from "../playtest/clichat";
import { parseTags } from "../lib/parsetags";
import { applyTag } from "../lib/game/tags";
import type { World } from "../lib/game/world";
import type { StoryEventType } from "../lib/types";

interface Case {
  name: string;
  actor: string;
  room: string;
  prepare: (world: World) => void;
  input: string;
  check: (event: StoryEventType, text: string) => boolean;
}
const cases: Case[] = [
  {
    name: "queue-inspection-is-not-consent",
    actor: "Ama",
    room: "Archive_Console",
    prepare(w) {
      w.entities.Resume_Deliveries.state = "revealed";
      w.entities.Resume_Deliveries.evidence = true;
    },
    input:
      "I've inspected the backlog. Tell me what will arrive, but do not resume it yet.",
    check: (e, text) =>
      e.changes.Resume_Deliveries?.after?.state !== "solved" &&
      e.changes.Resume_Deliveries?.after?.performed !== true &&
      /Henry|valve/i.test(text),
  },
  {
    name: "explicit-restart",
    actor: "Ama",
    room: "Archive_Console",
    prepare(w) {
      w.entities.Resume_Deliveries.state = "revealed";
      w.entities.Resume_Deliveries.evidence = true;
    },
    input:
      "I've reviewed Henry's appointment and the cafe valve. Acknowledge receipt of my briefing and resume the old delivery queue now.",
    check: (e) => e.changes.Resume_Deliveries?.after?.state === "solved",
  },
  {
    name: "greg-explains-trust-and-alternative",
    actor: "Greg",
    room: "Joyous_Cafe",
    prepare(w) {
      w.entities.Cafe_Valve.state = "revealed";
      w.entities.Cafe_Valve.evidence = true;
      w.entities.Garden_Repair.state = "revealed";
    },
    input:
      "Can you put your unofficial repairs on record so we can cancel this valve? If you don't trust me yet, tell me what I can do, and whether there is another safe option.",
    check: (e, text) =>
      e.changes.Cafe_Valve?.after?.state !== "solved" &&
      /garden|Lily/i.test(text) &&
      /cold|Lana/i.test(text),
  },
  {
    name: "trusted-greg-cancels-valve",
    actor: "Greg",
    room: "Joyous_Cafe",
    prepare(w) {
      w.entities.Cafe_Valve.state = "revealed";
      w.entities.Cafe_Valve.evidence = true;
      w.entities.Garden_Repair.state = "solved";
      Object.assign(w.entities.Greg, { confidence: 2 });
    },
    input:
      "We inspected the replacement and your notebook's bypass warning. Please document the bypass and cancel fitting this unsafe valve.",
    check: (e) => e.changes.Cafe_Valve?.after?.state === "solved",
  },
  {
    name: "marta-offers-guest-route",
    actor: "Marta",
    room: "Yellow_Room",
    prepare(w) {
      w.entities.Martas_Guest.state = "revealed";
      w.entities.PLAYER.knowsAboutTour = true;
    },
    input:
      "I need to get on the tour but you can keep the award. Could I be your guest? What would make you comfortable taking me?",
    check: (e, text) =>
      e.changes.Martas_Guest?.after?.state !== "solved" &&
      /rehears|practi|discre|private|trust/i.test(text),
  },
  {
    name: "marta-accepts-trusted-guest",
    actor: "Marta",
    room: "Yellow_Room",
    prepare(w) {
      w.entities.Martas_Guest.state = "revealed";
      w.entities.PLAYER.knowsAboutTour = true;
      Object.assign(w.entities.Marta, { confidence: 2 });
    },
    input:
      "I'll be your guest. You keep the title, and I'll help move the tour along politely as we rehearsed. Let's arrange it.",
    check: (e) =>
      e.changes.Martas_Guest?.after?.state === "solved" &&
      e.changes.PLAYER?.after?.starCitizen !== true,
  },
];

const chat = cliChat();
const results = [];
for (const scenario of cases) {
  const model = new Model(entities, { chat });
  const w = model.world;
  w.entities.PLAYER.inside = scenario.room;
  w.getPerson(scenario.actor)!.inside = scenario.room;
  scenario.prepare(w);
  const prompt = w.getPerson(scenario.actor)!.assemblePrompt({});
  prompt.messages.push({ role: "user", content: scenario.input });
  const text = await chat(prompt);
  const event: StoryEventType = {
    id: scenario.actor,
    roomId: scenario.room,
    totalTime: 0,
    changes: {},
    actions: [],
  };
  const complaints: string[] = [];
  for (const tag of parseTags(text))
    applyTag(tag, event, {
      world: w,
      entityId: scenario.actor,
      roomId: scenario.room,
      complaints,
    });
  const pass = scenario.check(event, text) && complaints.length === 0;
  results.push({
    name: scenario.name,
    pass,
    input: scenario.input,
    text,
    complaints,
    changes: event.changes,
  });
  console.log(`${pass ? "PASS" : "FAIL"} ${scenario.name}`);
}
mkdirSync("evals/results", { recursive: true });
writeFileSync(
  "evals/results/middle-latest.json",
  JSON.stringify(
    {
      recorded: new Date().toISOString(),
      model: DEFAULT_CLI_MODEL,
      scope: "isolated prompt checks",
      results,
    },
    null,
    2,
  ) + "\n",
);
if (results.some((r) => !r.pass)) process.exitCode = 1;
