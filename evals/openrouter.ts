import type { ChatFn } from "../lib/game/model";
import type { ChatType } from "../lib/types";

/**
 * An OpenRouter backend for evals.
 *
 * Separate from the app's lib/llm.ts on purpose: that one is the browser's,
 * with its persisted OAuth code and log signals. This is a plain function of
 * (model, messages) → text, which is all an eval needs, and it reads the key
 * from the environment so no credential goes near the repo.
 *
 *     OPENROUTER_API_KEY=sk-or-... pnpm evals --model openai/gpt-5.2
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterOptions {
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

export function openRouterChat(options: OpenRouterOptions): ChatFn {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set; export it or pass --backend cli",
    );
  }
  const timeoutMs = options.timeoutMs ?? 120_000;

  return async (request: ChatType): Promise<string> => {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: request.messages,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenRouter ${response.status}: ${detail.slice(0, 300)}`);
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error(
        `OpenRouter returned no content: ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
    return text;
  };
}
