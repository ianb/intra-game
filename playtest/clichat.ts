import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatType } from "../lib/types";
import type { ChatFn } from "../lib/game/model";
import { modelForTier } from "../lib/models";

// An LLM backend for the game, wired to a child `claude -p` process (Claude
// Code in print mode, tools disabled so it behaves as a single completion).
// This lets us playtest and evaluate the real engine against a real model with
// no OpenRouter key, by injecting it as the Model's `chat`. `model` picks the
// tier — the default is Haiku-level, which is what the game targets.
//
// This is a playtest tool, not part of the app or the deterministic test suite:
// it depends on the `claude` CLI being on PATH and makes non-deterministic model
// calls. See playtest/README.md.

export const DEFAULT_CLI_MODEL = "claude-haiku-4-5-20251001";

/**
 * An empty directory to run the CLI in.
 *
 * Claude Code reads the working directory: CLAUDE.md, the git repo, the project
 * layout. Run from this repo and the model playing Ama has *read the source of
 * the game it is acting in* — including a CLAUDE.md that explains the tag
 * protocol, the prompts and the evals. Asked what project it is in, it answers
 * "this is intra-game, a text-based game engine…".
 *
 * That contaminates everything measured through this backend in both
 * directions. Protocol compliance is flattered, because the model has been
 * briefed on the protocol somewhere other than the prompt under test. And the
 * frame leaks: two quest runs produced room descriptions addressing the
 * operator, one asking to "point me to a file in the project where tags are
 * defined", which is a coding assistant answering, not Ama.
 *
 * An empty temp dir gives it nothing to read, so what it gets is the prompt and
 * only the prompt — which is the thing being tested.
 */
const SANDBOX = mkdtempSync(join(tmpdir(), "intra-clichat-"));
process.on("exit", () => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

const NO_TOOLS = [
  "Bash",
  "Read",
  "Edit",
  "Write",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Task",
].join(" ");

/**
 * The nudge the game protocol needs and the player must never see.
 *
 * The CLI narrates by default, so the game path needs telling to emit tags and
 * nothing else. That instruction is specific to the *game* role, and appending
 * it to everything this backend sends was a real bug: the LLM player runs
 * through the same backend, so it was ordered to abandon its own reply format
 * on every single turn. It said so, in its SNAG report, seventeen times in one
 * run — "this creates an impossible contradiction" — while every quest since
 * the first quietly played against it.
 */
export const GAME_TAG_INSTRUCTION =
  "Respond now with ONLY the appropriate game tags, nothing else.";

export interface CliChatOptions {
  model?: string;
  /**
   * Text appended after the conversation. Pass "" for a caller that is not
   * speaking the game's tag protocol — the LLM player, for one.
   */
  instruction?: string;
  /**
   * Model for prompts that ask for the "flash" tier, if it should differ.
   *
   * This is how "can a small model handle the mechanical prompts?" gets
   * answered rather than guessed: run the evals with a pair and see what moves.
   */
  flashModel?: string;
  timeoutMs?: number;
  // Called with (prompt, response) after each completion, for tracing.
  onCall?: (info: { title: string; response: string }) => void;
}

export function cliChat(options: CliChatOptions = {}): ChatFn {
  const pro = options.model ?? DEFAULT_CLI_MODEL;
  const timeoutMs = options.timeoutMs ?? 120_000;
  return async (request: ChatType): Promise<string> => {
    // Both tiers are named explicitly, so the provider-form defaults in
    // modelForTier never apply — the claude CLI takes its own model names.
    const model = modelForTier(request.model, {
      pro,
      flash: options.flashModel,
    });
    const system = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const conversation = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
      .join("\n\n");
    const prompt = buildPrompt(conversation, options.instruction);
    const response = await runClaude({ model, system, prompt, timeoutMs });
    options.onCall?.({ title: request.meta.title, response });
    return response;
  };
}

/** The user-side text sent to the CLI: the conversation, plus any nudge. */
export function buildPrompt(
  conversation: string,
  instruction?: string,
): string {
  const trailer = instruction ?? GAME_TAG_INSTRUCTION;
  return trailer ? `${conversation}\n\n${trailer}` : conversation;
}

function runClaude({
  model,
  system,
  prompt,
  timeoutMs,
}: {
  model: string;
  system: string;
  prompt: string;
  timeoutMs: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      [
        "-p",
        "--model",
        model,
        "--disallowedTools",
        NO_TOOLS,
        "--append-system-prompt",
        system,
      ],
      // See SANDBOX: the model must not be able to read the game's source.
      { stdio: ["pipe", "pipe", "pipe"], cwd: SANDBOX },
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`claude timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(out.trim());
      } else {
        reject(new Error(err || `claude exited with code ${code}`));
      }
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
