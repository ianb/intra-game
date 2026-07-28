import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  backendName,
  chooseBackend,
  NO_BACKEND,
  type BackendEnv,
} from "./worker/backend";
import type { ChatType } from "./lib/types";
import type { UsageRecordType } from "./lib/usage";

/**
 * One real call to whatever backend the configuration selects.
 *
 *     pnpm smoke
 *
 * This exists because of a gap that let the same bug ship twice. Everything in
 * the test suite answers with a fake provider, and a fake accepts any request
 * body at all — so two parameters that a real endpoint rejects with a 400 went
 * out green: `usage: {include: true}`, then `reasoning: {effort}`. Both were
 * OpenRouter spellings sent to OpenAI through AI Gateway. Both were found by a
 * player mid-game.
 *
 * A test cannot cover this without spending money at a provider, so this is not
 * a test — it is one command, run by hand, that makes exactly one call using
 * `chooseBackend`, the same function the game uses. It reads .dev.vars, which is
 * also what `wrangler dev` reads, so pointing it at production means putting the
 * production values in there.
 *
 * What it proves is narrow and specific: the endpoint, the headers, the model id
 * and every parameter in the body are ones this provider accepts, and the
 * response streams and reports usage. It does not check that the game is good.
 */

const root = dirname(fileURLToPath(import.meta.url));

/**
 * The subset of .dev.vars this needs.
 *
 * Deliberately not a dotenv dependency: the format wrangler actually accepts is
 * KEY=value per line, and anything cleverer here would be a second opinion
 * about a file wrangler already owns.
 */
function readDevVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(resolve(root, ".dev.vars"), "utf8");
  } catch {
    return vars;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const value = trimmed.slice(eq + 1).trim();
    vars[trimmed.slice(0, eq).trim()] = value.replace(/^["']|["']$/g, "");
  }
  return vars;
}

/**
 * A prompt in the shape the engine sends, short enough to cost nothing.
 *
 * The point is the envelope rather than the content: same fields, same tier,
 * same streaming, so anything the provider objects to in a real turn it objects
 * to here.
 */
const ASK: ChatType = {
  meta: { title: "smoke test" },
  messages: [
    { role: "system", content: "Answer with one word and nothing else." },
    { role: "user", content: "Say OK." },
  ],
};

async function main(): Promise<void> {
  // Real environment wins, so a value can be supplied for one run without
  // editing the file.
  const env = { ...readDevVars(), ...process.env } as unknown as BackendEnv;

  let usage: UsageRecordType | undefined;
  const backend = chooseBackend(env, {
    user: "smoke",
    onUsage: (record) => {
      usage = record;
    },
  });
  if (!backend) {
    console.error(`${NO_BACKEND}\nLooked in .dev.vars and the environment.`);
    process.exit(1);
  }

  const name = backendName(env);
  console.log(`Backend:  ${name}`);
  if (env.DEV_FAKE_LLM) {
    // The exact trap this script was written for. The stand-in accepts any
    // request body, so a green run against it says nothing about a provider,
    // and DEV_FAKE_LLM is checked first — it is on in .dev.vars by default.
    console.log(
      "          ^ the stand-in accepts any request; this proves nothing.\n" +
        "            Unset DEV_FAKE_LLM to call a provider.",
    );
  }
  console.log(`Model:    ${env.GATEWAY_MODEL ?? "(default)"}`);
  if (env.GATEWAY_REASONING) {
    console.log(`Thinking: ${env.GATEWAY_REASONING}`);
  }
  console.log("");

  let deltas = 0;
  let answer: string;
  try {
    answer = await backend(ASK, () => {
      deltas++;
    });
  } catch (e) {
    // The provider's own words, which is the whole value of this: a 400 names
    // the parameter it refused.
    console.error(`FAILED\n\n${String(e)}\n`);
    process.exit(1);
  }

  console.log(`Answer:   ${JSON.stringify(answer.trim().slice(0, 80))}`);
  console.log(`Deltas:   ${deltas}`);
  if (!usage) {
    // Not fatal — the call worked — but the quota is metered from this, so a
    // backend that reports nothing meters every turn at zero.
    console.log("Usage:    none reported (the quota would meter this at zero)");
  } else {
    console.log(
      `Usage:    ${usage.promptTokens} in, ${usage.completionTokens} out` +
        (usage.reasoningTokens ? ` (${usage.reasoningTokens} thinking)` : "") +
        `, $${(usage.cost ?? 0).toFixed(6)}`,
    );
  }
  if (!deltas) {
    console.log("\nThe call succeeded but streamed no text.");
    process.exit(1);
  }
  console.log("\nOK");
}

void main();
