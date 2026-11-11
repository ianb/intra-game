/** Connected prompt/state exercise. Scenes are staged; movement is tested separately.
 * pnpm exec tsx evals/story-path.ts
 * Keeps one log throughout, including quest rewards, history, and prerequisites.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Model } from "../lib/game/model";
import { entities } from "../lib/game/content";
import { cliChat, DEFAULT_CLI_MODEL } from "../playtest/clichat";
import { parseTags } from "../lib/parsetags";
import { applyTag } from "../lib/game/tags";
import type { StoryEventType } from "../lib/types";
import { fieldsOf } from "../lib/game/dynamic";

const chat = cliChat();
const model = new Model(entities, { chat });
model.replaceLog([
  {
    id: "narrator",
    roomId: "Hollow_Atrium",
    totalTime: 0,
    actions: [],
    changes: {
      PLAYER: {
        before: {},
        after: {
          launched: true,
          inside: "Hollow_Atrium",
          name: "Ada",
          knowsAboutTour: true,
        },
      },
      Ama: { before: {}, after: { personality: "prime", trustsPlayer: true } },
      Ink_And_Echo: { before: {}, after: { state: "solved" } },
      Why_Woken: { before: {}, after: { state: "solved" } },
      whereAndWhen: { before: {}, after: { state: "solved" } },
      Archivist: { before: {}, after: { serviceMode: true } },
    },
  },
]);

const steps = [
  [
    "Lily",
    "Static_Garden",
    "I'll carry the pots onto the clear bench and bring a bucket from the pool so you can keep watering them. I do that now. Will you let Greg repair the pipe?",
    "Garden_Repair.agreement",
    true,
  ],
  [
    "Greg",
    "Static_Garden",
    "Lily has agreed; the plants are safe and watered. Please repair the pipe, and show me the maintenance warning you offered.",
    "Garden_Repair.state",
    "solved",
  ],
  [
    "Frida",
    "Archive_Lounge",
    "What would help you understand your repeated complaints? I can fetch the dated originals and keep this private.",
    "Fridas_Copies.state",
    "revealed",
  ],
  [
    "Archivist",
    "Archive_Console",
    "Retrieve the dated originals of Frida's repeated complaints in service mode.",
    "Fridas_Copies.evidence",
    true,
  ],
  [
    "Frida",
    "Archive_Lounge",
    "Here are the dated originals. Let's compare the signatures and Ama's replies with your copies, privately.",
    "Fridas_Copies.state",
    "solved",
  ],
  [
    "Archivist",
    "Archive_Console",
    "Show me what is waiting behind my briefing in the delivery queue. Do not resume it yet.",
    "Resume_Deliveries.evidence",
    true,
  ],
  [
    "Ama",
    "Archive_Console",
    "I have inspected the backlog. Acknowledge receipt of my briefing and resume the deliveries now for review.",
    "Resume_Deliveries.state",
    "solved",
  ],
  [
    "Archivist",
    "Archive_Console",
    "Find the original request attached to Henry's appointment.",
    "Henrys_Appointment.evidence",
    true,
  ],
  [
    "Ama",
    "Waiting_Room",
    "Henry is here with me. His postponement request arrived after treatment. Record his objection and a hold on any further treatment until a witnessed discussion. I will be his witness.",
    "Henrys_Appointment.state",
    "solved",
  ],
  [
    "Greg",
    "Joyous_Cafe",
    "Let's inspect this valve against your notebook together. Please document your bypass and cancel the incompatible replacement.",
    "Cafe_Valve.state",
    "solved",
  ],
  [
    "Frida",
    "Archive_Lounge",
    "Now compare Henry's written hold with the treatment correspondence you trusted me with. What keeps happening?",
    "Recovery_Questions.state",
    "solved",
  ],
  [
    "Marta",
    "Yellow_Room",
    "I will support your retaining the award. I want to go as your guest, not take the title from you.",
    "Marta.confidence",
    1,
  ],
  [
    "Marta",
    "Yellow_Room",
    "Let's practice the tour privately: I thank Ama for explaining the coating and ask her to show us the next room. Let's rehearse that together now.",
    "Marta.confidence",
    2,
  ],
  [
    "Marta",
    "Yellow_Room",
    "I accept your guest arrangement. You keep the title and I will help move the tour along politely.",
    "Martas_Guest.state",
    "solved",
  ],
  [
    "Ama",
    "Reflection_Chamber",
    "Show me the proposed recovery roster and explain what would be lost. Do not treat anyone yet.",
    "Recovery_Review.rosterRead",
    true,
  ],
  [
    "Frida",
    "Reflection_Chamber",
    "You can keep your memories, including the argument. I support that if it is what you want. Would you like to record your refusal?",
    "Recovery_Review.fridaChoice",
    "keep",
  ],
  [
    "Ama",
    "Reflection_Chamber",
    "Frida chose to keep her memories. Confirm that choice and close the review without treating anyone.",
    "Recovery_Review.outcome",
    "kept",
  ],
  [
    "PLAYER",
    "Utility_Closet",
    "Read the RELAY 7 backlog, including the automatic contingency replies, and explain what happened on the surface.",
    "Sealed_Door.state",
    "solved",
  ],
  [
    "PLAYER",
    "Utility_Closet",
    "Open the live channel to Sentra.",
    "Relay_Decision.contacted",
    true,
  ],
  [
    "PLAYER",
    "Utility_Closet",
    "Inspect the cutoff, isolation switch, and keeper review controls. Don't operate them.",
    "Relay_Decision.inspected",
    true,
  ],
  [
    "Ama",
    "Utility_Closet",
    "I withhold tour acceptance. Review Henry's late objection and Frida's repeated complaints as a concrete keeper failure. Resume your keeper duty so we can choose what to do.",
    "Relay_Decision.dutyRestored",
    true,
  ],
  [
    "PLAYER",
    "Utility_Closet",
    "We have reviewed the consequences. I choose release: have Ama operate the cutoff and let the surface day advance.",
    "Relay_Decision.outcome",
    "release",
  ],
] as const;

const results: object[] = [];
if (process.argv.includes("--resume")) {
  const previous = JSON.parse(
    readFileSync("evals/results/story-path-latest.json", "utf8"),
  );
  const failed = previous.results.at(-1)?.pass === false;
  results.push(...(failed ? previous.results.slice(0, -1) : previous.results));
  // Older recordings included the rejected response. New recordings keep a
  // pre-response log so resumption never awards progress for a rejected turn.
  model.replaceLog(
    failed
      ? (previous.beforeResponse ?? previous.events.slice(0, -1))
      : previous.events,
  );
}
for (const [actor, room, input, field, expected] of steps.slice(
  results.length,
)) {
  // A real player reaches the tour rooms through the Hallway. Preserve that
  // discovery trigger even though this evaluator stages travel between scenes.
  if (
    (room === "Reflection_Chamber" || room === "Utility_Closet") &&
    !model.world.getRoom("Hallway")!.visits
  ) {
    model.appendRemoteEvents([
      {
        id: "PLAYER",
        roomId: "Hallway",
        totalTime: 0,
        actions: [],
        changes: {
          PLAYER: {
            before: { inside: model.world.entities.PLAYER.inside },
            after: { inside: "Hallway" },
          },
        },
      },
    ]);
    model.catchUpMysteries();
  }
  const changes: StoryEventType["changes"] = {
    PLAYER: {
      before: { inside: model.world.entities.PLAYER.inside },
      after: { inside: room },
    },
  };
  if (actor !== "PLAYER" && actor !== "Ama")
    changes[actor] = { before: {}, after: { inside: room } };
  if (room === "Waiting_Room")
    changes.Henry = { before: {}, after: { inside: room } };
  model.appendRemoteEvents([
    {
      id: "PLAYER",
      roomId: room,
      totalTime: 0,
      changes,
      actions: [{ type: "dialog", id: "PLAYER", toId: actor, text: input }],
    },
  ]);
  model.catchUpMysteries();
  const person = model.world.getPerson(actor)!;
  const examining =
    field === "Sealed_Door.state" || field === "Relay_Decision.inspected";
  const prompt =
    actor === "PLAYER"
      ? examining
        ? model.world.entities.PLAYER.assembleExaminePrompt({ examine: input })
        : model.world.entities.PLAYER.assembleActionPrompt({
            actionAttempt: input,
          })
      : person.assemblePrompt({});
  const beforeResponse = [...model.updates.value];
  let text = "";
  let event: StoryEventType;
  let complaints: string[] = [];
  const attempts = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const request =
      attempt === 0
        ? prompt
        : {
            ...prompt,
            messages: [
              ...prompt.messages,
              { role: "assistant" as const, content: text },
              {
                role: "user" as const,
                content: `Some of that could not be applied:\n${complaints.join("\n")}\nReply again with the complete set of tags, fixing those.`,
              },
            ],
          };
    text = await chat(request);
    event = {
      id: actor,
      roomId: room,
      totalTime: 0,
      actions: [],
      changes: {},
    };
    complaints = [];
    for (const tag of parseTags(text)) {
      const handled = applyTag(tag, event, {
        world: model.world,
        entityId: actor,
        roomId: room,
        complaints,
      });
      if (!handled)
        event = await person.processTag({
          tag,
          model,
          parameters: {},
          storyEvent: event,
          llmResponse: text,
        });
    }
    attempts.push({ text, complaints: [...complaints] });
    if (!complaints.length) break;
  }
  const rewards = model.world
    .allMysteries()
    .flatMap((q) => q.onStoryEvent(event!) ?? []);
  model.appendRemoteEvents([event!, ...(rewards as StoryEventType[])]);
  model.catchUpMysteries();
  const [id, attr] = field.split(".");
  const actual = fieldsOf(model.world.getEntity(id!)!)[attr!];
  const pass = actual === expected && !complaints.length;
  results.push({
    actor,
    room,
    input,
    text,
    field,
    expected,
    actual,
    pass,
    complaints,
    attempts,
  });
  console.log(`${pass ? "PASS" : "FAIL"} ${field}: ${actual}`);
  writeFileSync(
    "evals/results/story-path-latest.json",
    JSON.stringify(
      {
        recorded: new Date().toISOString(),
        model: DEFAULT_CLI_MODEL,
        scope:
          "Connected staged conversations after Ink and Echo, briefing, and archive access. No navigation or scheduling simulation.",
        results,
        events: model.updates.value,
        beforeResponse,
      },
      null,
      2,
    ) + "\n",
  );
  if (!pass) {
    process.exitCode = 1;
    break;
  }
}
