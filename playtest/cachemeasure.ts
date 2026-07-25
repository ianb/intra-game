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

const prompts: {
  title: string;
  text: string;
  whole: string;
  afterName: boolean;
}[] = [];
let named = false;
let turn = 0;

const model = new Model(entities, {
  chat: async (request: ChatType) => {
    const title = request.meta.title;
    // Every prompt, not just Ama's: which prompts share a prefix with which is
    // exactly the question when deciding what can be routed to another model.
    prompts.push({
      title: title ?? "(untitled)",
      text: String(request.messages[0]!.content),
      // The whole request too: a cache prefix covers the message array, not the
      // system message, and the minimum length applies to the total.
      whole: request.messages.map((m) => `${m.role}:${m.content}`).join("\n"),
      afterName: named,
    });
    if (title === "player input") {
      // Steer the router into each of its branches, so examine / move / action
      // prompts actually get assembled and can be measured too. The fake reads
      // the player's line out of the prompt, since that's all it is given.
      const text = String(request.messages.at(-1)?.content ?? "");
      if (text.includes("look at"))
        return `<examine>look at the statues</examine>`;
      if (text.includes("go to")) return `<goto>Foyer</goto>`;
      if (text.includes("open"))
        return `<action minutes="5">You attempt to open the door.</action>`;
      return `<dialog character="PLAYER">hello</dialog>`;
    }
    if (title?.startsWith("player")) {
      return `<description>Something happens.</description>`;
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
  "what is this place",
  "who else lives here",
  "tell me about the food",
  "tell me about the rules",
  "how long have I been here",
  "what happens next",
  "is anyone else awake",
  "tell me about yourself",
  "what should I do now",
  "look at the statues",
  "look at the ceiling",
  "look at the floor",
  "open the door",
  "open the panel",
  "open the hatch",
  "go to the foyer",
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

// Rough, but the only thing that matters is which side of a 1024/2048-token
// threshold a prompt sits on, and ~4 chars/token is nowhere near that margin.
const tokens = (chars: number) => Math.round(chars / 4);

const report = (label: string, texts: string[]) => {
  if (!texts.length) return console.log(`${label}: no prompts`);
  const avg = Math.round(
    texts.reduce((a, p) => a + p.length, 0) / texts.length,
  );
  if (texts.length < 2) {
    return console.log(
      `${label}: only ${texts.length} prompt, ~${avg} chars (~${tokens(avg)} tokens)`,
    );
  }
  const shared = commonPrefix(texts);
  console.log(
    `${label}: ${texts.length} prompts, ~${avg} chars (~${tokens(avg)} tokens), ` +
      `shared ${shared} (${Math.round((shared / avg) * 100)}%)`,
  );
};

const ama = prompts.filter((p) => p.title === "prompt Ama");
report(
  "all Ama prompts",
  ama.map((p) => p.text),
);
report(
  "after the name is known",
  ama.filter((p) => p.afterName).map((p) => p.text),
);

// --- What can be routed to a different model ---------------------------------
//
// A prefix cache is keyed by (model, exact prefix), so two prompt kinds share a
// cache entry only if they share a prefix. Below is the per-kind picture: how
// much each kind reuses of itself, and how much any two kinds have in common.
// Where that second number is ~0, sending one kind to a small model cannot cost
// the other kind a single cache hit — they were never in the same entry.

console.log("\nPer prompt kind (system message):");
const kinds = [...new Set(prompts.map((p) => p.title))].sort();
for (const kind of kinds) {
  report(
    `  ${kind}`,
    prompts.filter((p) => p.title === kind).map((p) => p.text),
  );
}

// What a provider actually sees. A cache prefix covers the message array, not
// the system message alone, and Anthropic will not cache a prefix below ~1024
// tokens (~2048 for Haiku-class). That threshold decides whether a prompt is
// cacheable at all, before any question of how well ordered it is.
console.log(
  "\nPer prompt kind (whole request — what a cache minimum applies to):",
);
for (const kind of kinds) {
  report(
    `  ${kind}`,
    prompts.filter((p) => p.title === kind).map((p) => p.whole),
  );
}

// The steady state, and the number that decides what can be cached in practice.
//
// The message array is [system, ...history, user], and historyForEntity returns
// the *last* N events — a sliding window, not a growing conversation. So once
// the window is full every turn drops the oldest message, the history differs
// from the previous turn, and nothing after the system message can ever be part
// of a shared prefix. The cacheable region is exactly the stable half of the
// system message, no matter how long the game runs.
const settled = prompts.filter((p) => p.title === "prompt Ama" && p.afterName);
report(
  "\nprompt Ama, steady state (whole request)",
  settled.map((p) => p.whole),
);
report(
  "prompt Ama, steady state (system only)",
  settled.map((p) => p.text),
);
if (settled.length > 1) {
  const cacheable = commonPrefix(settled.map((p) => p.whole));
  const total = Math.round(
    settled.reduce((a, p) => a + p.whole.length, 0) / settled.length,
  );
  console.log(
    `  → cacheable prefix ~${tokens(cacheable)} tokens of ~${tokens(total)}; ` +
      `the remaining ~${tokens(total - cacheable)} are re-read every turn`,
  );
}

console.log("\nShared prefix between kinds (chars):");
const firstOf = (kind: string) => prompts.find((p) => p.title === kind)!.text;
for (let i = 0; i < kinds.length; i++) {
  for (let j = i + 1; j < kinds.length; j++) {
    const shared = commonPrefix([firstOf(kinds[i]!), firstOf(kinds[j]!)]);
    console.log(`  ${kinds[i]} ↔ ${kinds[j]}: ${shared}`);
  }
}
