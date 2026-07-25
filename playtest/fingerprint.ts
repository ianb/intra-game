import { createHash } from "node:crypto";
import { entities } from "../lib/game/content";
import { Model } from "../lib/game/model";
import type { ChatType } from "../lib/types";
import { installSeededRandom } from "./seed";

/**
 * A short hash of the prompts this game actually produces.
 *
 * Eval results are compared across weeks, and the question a stale-looking
 * number raises is always the same: did the game change, or is the model just
 * sampling? Nothing in a results file answered that — the date and the model id
 * say nothing about the prompt the model was answering.
 *
 * This is not a cache key and nothing is invalidated by it. It is provenance:
 * two runs with the same fingerprint were measured against the same prompts, and
 * two with different fingerprints were not, so a difference between them is not
 * a difference in the model.
 *
 * It moves when prompt *text* moves, and also when the game state feeding those
 * prompts moves — a changed room description, a changed schedule. That's wider
 * than "someone edited a template", and deliberately so: both change what the
 * model was asked.
 */

/** Fixed so the fingerprint depends on the game, not on when it was taken. */
const SEED = 606;

const SCRIPT = ["Hello? Where am I?", "My name is Ada Quill."];

async function settle(model: Model): Promise<void> {
  while (model.runningSignal.value) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Drive a few turns against a scripted LLM and hash every system prompt the
 * engine assembled along the way.
 *
 * Scripted rather than recorded: this must not need a cassette (which goes
 * stale exactly when the prompts change, which is the moment this is wanted)
 * and must not make a network call, so it can run at the top of an eval before
 * anything expensive happens.
 */
export async function promptFingerprint(): Promise<string> {
  const restore = installSeededRandom(SEED);
  const prompts: string[] = [];
  try {
    const model = new Model(entities, {
      chat: async (request: ChatType) => {
        for (const message of request.messages) {
          if (message.role === "system") {
            prompts.push(`${request.meta.title}\n${message.content}`);
          }
        }
        if (request.meta.title?.startsWith("player")) {
          return `<dialog character="PLAYER">hello</dialog>`;
        }
        return `<context>ok</context>\n<dialog character="Ama">Hello.</dialog>`;
      },
    });
    model.checkLaunch();
    await settle(model);
    for (const input of SCRIPT) {
      await model.sendText(input);
      await settle(model);
    }
  } finally {
    restore();
  }
  return createHash("sha256")
    .update(prompts.join("\n---\n"))
    .digest("hex")
    .slice(0, 12);
}
