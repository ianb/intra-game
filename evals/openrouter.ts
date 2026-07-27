import type { ChatFn } from "../lib/game/model";
import { modelForTier } from "../lib/models";
import type { ChatType } from "../lib/types";
import { usageRecord, type RawUsage, type UsageRecordType } from "../lib/usage";

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
  /** Model for prompts asking for the "flash" tier; defaults to `model`. */
  flashModel?: string;
  apiKey?: string;
  timeoutMs?: number;
  /** How many times to retry a transient failure. */
  retries?: number;
  /**
   * How hard the model should think, where it can be told.
   *
   * Worth measuring rather than accepting: gpt-5-nano's default emits ~576
   * reasoning tokens before a one-tag answer and takes nineteen seconds, while
   * "low" emits 128 and takes two. If the score survives, that is most of the
   * cost and most of the latency for nothing.
   */
  reasoningEffort?: string;
  /** Called once per completed call with what it cost. */
  onUsage?: (record: UsageRecordType) => void;
}

/**
 * Is this worth trying again?
 *
 * A 429 or a 5xx is the provider being busy, and a DNS or timeout failure is
 * the network. None of them say anything about the model, which is what an
 * eval is measuring — so retrying is not papering over a result, it is
 * refusing to record someone else's outage as a model's score.
 *
 * A 400 or a 401 is not retried: the request is wrong and will stay wrong.
 */
export function isTransient(error: unknown): boolean {
  const message = String(error);
  return (
    /OpenRouter (408|409|425|429|5\d\d)/.test(message) ||
    /timeout|aborted|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|DNS/i.test(
      message,
    )
  );
}

export function openRouterChat(options: OpenRouterOptions): ChatFn {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set; export it or pass --backend cli",
    );
  }
  const timeoutMs = options.timeoutMs ?? 120_000;

  const retries = options.retries ?? 3;

  const once = async (request: ChatType): Promise<string> => {
    const started = Date.now();
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelForTier(request.model, {
          pro: options.model,
          flash: options.flashModel,
        }),
        messages: request.messages,
        // Ask for the bill. Without this a call reports nothing about itself,
        // and a model's cost has to be guessed from token estimates — which is
        // how a reasoning model's price came out four times too low.
        usage: { include: true },
        ...(options.reasoningEffort
          ? { reasoning: { effort: options.reasoningEffort } }
          : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenRouter ${response.status}: ${detail.slice(0, 300)}`);
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: RawUsage;
    };
    options.onUsage?.(
      usageRecord({
        request,
        model: modelForTier(request.model, {
          pro: options.model,
          flash: options.flashModel,
        }),
        raw: body.usage,
        ms: Date.now() - started,
      }),
    );
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error(
        `OpenRouter returned no content: ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
    return text;
  };

  /**
   * Retry transient failures, with a widening gap.
   *
   * This was learned the expensive way: one 503 and one timeout, in two
   * separate batches, each killed the whole run and discarded every model that
   * had not been scored yet. An eval that dies on someone else's bad minute
   * measures uptime rather than models.
   */
  return async (request: ChatType): Promise<string> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await once(request);
      } catch (e) {
        lastError = e;
        if (!isTransient(e) || attempt === retries) {
          throw e;
        }
        const waitMs = 2000 * 2 ** attempt;
        console.warn(
          `  retrying after ${String(e).slice(0, 80)} (${waitMs}ms)`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw lastError;
  };
}
