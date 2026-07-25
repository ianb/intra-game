import { spawn } from "node:child_process";
import type { ChatType } from "../lib/types";
import type { ChatFn } from "../lib/game/model";

// A Haiku-level LLM backend for the game, wired to a child `claude -p` process
// (Claude Code in print mode, tools disabled so it behaves as a single
// completion). This lets us playtest the real engine with a real small model —
// no OpenRouter key required — by injecting it as the Model's `chat`.
//
// This is a playtest tool, not part of the app or the deterministic test suite:
// it depends on the `claude` CLI being on PATH and makes non-deterministic model
// calls. See playtest/README.md.

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

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

export interface HaikuChatOptions {
  model?: string;
  timeoutMs?: number;
  // Called with (prompt, response) after each completion, for tracing.
  onCall?: (info: { title: string; response: string }) => void;
}

export function haikuChat(options: HaikuChatOptions = {}): ChatFn {
  const model = options.model ?? HAIKU_MODEL;
  const timeoutMs = options.timeoutMs ?? 120_000;
  return async (request: ChatType): Promise<string> => {
    const system = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const conversation = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
      .join("\n\n");
    const prompt = `${conversation}\n\nRespond now with ONLY the appropriate game tags, nothing else.`;
    const response = await runClaude({ model, system, prompt, timeoutMs });
    options.onCall?.({ title: request.meta.title, response });
    return response;
  };
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
      { stdio: ["pipe", "pipe", "pipe"] }
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
