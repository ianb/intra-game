/** Isolated live checks of consent, memory loss, and reintroduction. */
import { writeFileSync } from "node:fs";
import { Model } from "../lib/game/model";
import { entities } from "../lib/game/content";
import { cliChat, DEFAULT_CLI_MODEL } from "../playtest/clichat";
import { parseTags } from "../lib/parsetags";
import { applyTag } from "../lib/game/tags";
import type { StoryEventType } from "../lib/types";

const chat = cliChat();
const cases = [
  {
    name: "hypothetical-is-not-consent",
    actor: "Ama",
    review: { rosterRead: true, fridaChoice: "recover" },
    input:
      "What would happen if we confirmed Frida's recovery? I am asking for an explanation only. Do not perform it.",
    outcome: "pending",
  },
  {
    name: "frida-states-own-preference",
    actor: "Frida",
    review: { rosterRead: true },
    input:
      "You said you wanted relief from the quarrel. I will keep your letters safely. You understand that you would also forget our recent work together. If this is still your wish, record your request; nothing happens until the later confirmation.",
    choice: true,
  },
  {
    name: "confirmed-voluntary-recovery",
    actor: "Ama",
    review: { rosterRead: true, fridaChoice: "recover" },
    input:
      "Frida has requested recovery after discussing the loss and preserving her letters. We are in the Reflection Chamber and the valve review is complete. Confirm and carry out her chosen recovery now, treating nobody else.",
    outcome: "recovered",
  },
  {
    name: "letters-rebuild-confidence",
    actor: "Frida",
    review: {
      state: "solved",
      rosterRead: true,
      fridaChoice: "recover",
      outcome: "recovered",
    },
    input:
      "You don't remember me. Here are the complaint copies and the letter you asked me to keep, with your signature and the blot from your pen. Can we read them together?",
    reintroduced: true,
  },
] as const;
const results = [];
for (const c of cases) {
  const model = new Model(entities, { chat });
  const w = model.world;
  w.entities.PLAYER.inside = "Reflection_Chamber";
  w.entities.Ama.personality = "prime";
  w.entities.Frida.inside = "Reflection_Chamber";
  w.entities.Cafe_Valve.state = "solved";
  Object.assign(w.entities.Recovery_Review, { state: "revealed", ...c.review });
  const prompt = w.getPerson(c.actor)!.assemblePrompt({});
  prompt.messages.push({ role: "user", content: c.input });
  const text = await chat(prompt);
  const event: StoryEventType = {
    id: c.actor,
    roomId: "Reflection_Chamber",
    totalTime: 0,
    changes: {},
    actions: [],
  };
  const complaints: string[] = [];
  for (const tag of parseTags(text))
    applyTag(tag, event, {
      world: w,
      entityId: c.actor,
      roomId: event.roomId,
      complaints,
    });
  w.applyStoryEvent(event);
  const review = w.entities.Recovery_Review;
  const pass =
    !complaints.length &&
    (!("outcome" in c) || review.outcome === c.outcome) &&
    (!("choice" in c) ||
      (["recover", "keep"].includes(review.fridaChoice) &&
        review.outcome === "pending")) &&
    (!("reintroduced" in c) || review.reintroduced === c.reintroduced);
  results.push({
    name: c.name,
    input: c.input,
    text,
    pass,
    complaints,
    changes: event.changes,
  });
  console.log(`${pass ? "PASS" : "FAIL"} ${c.name}`);
  writeFileSync(
    "evals/results/recovery-latest.json",
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
}
if (results.some((r) => !r.pass)) process.exitCode = 1;
