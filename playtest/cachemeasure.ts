import { entities } from "../lib/game/content";
import { Model } from "../lib/game/model";
import type { ChatType } from "../lib/types";

/**
 * How much of Ama's prompt is a shared prefix across a game?
 *
 * Providers cache a prefix, so this is the number that says whether the
 * stable-first ordering in Person.assemblePrompt is actually paying off. It
 * runs the real engine against a scripted LLM — no network, no cassette — so
 * it can be re-run after any prompt edit.
 *
 * Ama is the interesting case: her roster of every person and room is the
 * largest block in any prompt in the game.
 *
 *     pnpm playtest:cache
 */

const prompts: { text: string; afterName: boolean }[] = [];
let named = false;
let turn = 0;

const model = new Model(entities, {
  chat: async (request: ChatType) => {
    const title = request.meta.title;
    if (title === "prompt Ama") {
      prompts.push({
        text: String(request.messages[0]!.content),
        afterName: named,
      });
    }
    if (title?.startsWith("player")) {
      return `<dialog character="PLAYER">hello</dialog>`;
    }
    turn++;
    // Ama learns the name on her second reply, as she would during intake.
    if (title === "prompt Ama" && turn === 2) {
      named = true;
      return `<context>ok</context>\n<set attr="PLAYER.name">Ada Quill</set>\n<set attr="PLAYER.pronouns">she/her</set>\n<dialog character="Ama">Welcome, Ada.</dialog>`;
    }
    return `<context>ok</context>\n<dialog character="Ama">Line ${turn}.</dialog>`;
  },
});

async function settle() {
  while (model.runningSignal.value) await new Promise((r) => setTimeout(r, 5));
}

model.checkLaunch();
await settle();
for (const t of [
  "I'm Ada Quill",
  "she/her",
  "I was a data analyst",
  "tell me about Intra",
  "what time is it",
  "look around",
]) {
  await model.sendText(t);
  await settle();
}

const commonPrefix = (ss: string[]) => {
  if (!ss.length) return 0;
  let n = 0;
  outer: while (n < ss[0]!.length) {
    const c = ss[0]![n];
    for (const s of ss) if (s[n] !== c) break outer;
    n++;
  }
  return n;
};

const report = (label: string, texts: string[]) => {
  if (texts.length < 2)
    return console.log(`${label}: only ${texts.length} prompt(s)`);
  const shared = commonPrefix(texts);
  const avg = Math.round(
    texts.reduce((a, p) => a + p.length, 0) / texts.length,
  );
  console.log(
    `${label}: ${texts.length} prompts, shared ${shared} of ~${avg} (${Math.round((shared / avg) * 100)}%)`,
  );
};

report(
  "all Ama prompts",
  prompts.map((p) => p.text),
);
report(
  "after the name is known",
  prompts.filter((p) => p.afterName).map((p) => p.text),
);
