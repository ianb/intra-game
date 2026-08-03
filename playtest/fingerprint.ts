import { createHash } from "node:crypto";
import { entities } from "../lib/game/content";
import { Model } from "../lib/game/model";
import { isPerson } from "../lib/types";
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
        // Every message, not just the system one. The system message was the
        // obvious place for prompt text and is not where most of it is: Ama's
        // whole intake checklist comes from additionalPromptInstructions and
        // lands in the *user* message, as does the <responseFormat> block every
        // character prompt ends with. Both were invisible here — the checklist
        // could be rewritten and this would report the same twelve characters,
        // which is the one thing it exists not to do.
        for (const message of request.messages) {
          prompts.push(
            `${request.meta.title}/${message.role}\n${message.content}`,
          );
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
    // The drive above only reaches the prompts intake happens to produce,
    // which is how two edits moved nothing: the action-adjudication prompt
    // changed and a run recorded under the same fingerprint as its
    // predecessor, silently replacing it (same runKey), and Milton's meter
    // block never reached any hashed prompt at all. Sweep the rest
    // statically: every character's assembled prompt, and each of the
    // player's prompt shapes.
    const world = model.world;
    for (const person of Object.values(world.entities).filter(isPerson)) {
      if (person.id === "PLAYER") {
        continue;
      }
      collect(prompts, person.assemblePrompt({}));
    }
    const player = world.entities.PLAYER;
    collect(prompts, player.assemblePrompt({}));
    collect(prompts, player.assemblePrompt({ examine: "look around" }));
    collect(prompts, player.assemblePrompt({ actionAttempt: "inspect the table" }));
    // The move prompt needs a restricted exit to assemble; the sealed
    // maintenance door is the one whose restriction text matters.
    player.inside = "Hallway";
    collect(prompts, player.assemblePrompt({ attemptMoveTo: "Reflection_Chamber" }));
  } finally {
    restore();
  }
  return createHash("sha256")
    .update(prompts.join("\n---\n"))
    .digest("hex")
    .slice(0, 12);
}

function collect(prompts: string[], chat: ChatType): void {
  for (const message of chat.messages) {
    prompts.push(`${chat.meta.title}/${message.role}\n${message.content}`);
  }
}
