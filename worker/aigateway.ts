import type { ChatStreamFn } from "../lib/game/model";
import { readSse } from "../lib/ssestream";
import { modelForTier } from "../lib/models";
import { usageRecord, type RawUsage, type UsageRecordType } from "../lib/usage";
import type { ChatType } from "../lib/types";

/**
 * The LLM backend, talking to Cloudflare AI Gateway.
 *
 * AI Gateway fronts many providers behind one OpenAI-compatible endpoint, with
 * model ids in `provider/model` form (`anthropic/claude-4-5-sonnet`,
 * `openai/gpt-5.2`, `workers-ai/@cf/...`) — the same shape OpenRouter used, so
 * the model ids the game already stores carry over.
 *
 * This runs server-side because the gateway token is ours, not the player's. A
 * player may supply their own provider key instead, which is passed through as
 * `Authorization` while the gateway token still identifies the account.
 */

export interface GatewayConfig {
  accountId: string;
  /** Our Cloudflare AI Gateway token. Never sent to the client. */
  token: string;
  /** Model for the "pro" tier, in `provider/model` form. */
  model: string;
  /**
   * Model for prompts that ask for the "flash" tier; falls back to `model`.
   *
   * Worth setting: routing the mechanical prompts to a small model costs the
   * character prompts nothing in cache terms — they share 19 characters of
   * prefix, so they were never in the same cache entry (`pnpm playtest:cache`).
   */
  flashModel?: string;
  /** A player's own provider key, when they brought one. */
  providerKey?: string;
  /** Called once per completed call with what it cost; see lib/usage.ts. */
  onUsage?: (record: UsageRecordType) => void;
  /** Stamped onto usage records — the Access-verified caller. */
  user?: string;
}

function endpoint(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
}

/**
 * A streaming `ChatStreamFn`: reports text deltas as they arrive and resolves to
 * the complete response, so the engine's authoritative parse is unchanged.
 */
export function gatewayChatStream(config: GatewayConfig): ChatStreamFn {
  return async (request: ChatType, onDelta: (delta: string) => void) => {
    const started = Date.now();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "cf-aig-authorization": `Bearer ${config.token}`,
    };
    if (config.providerKey) {
      headers.authorization = `Bearer ${config.providerKey}`;
    }
    const response = await fetch(endpoint(config.accountId), {
      method: "POST",
      headers,
      body: JSON.stringify({
        // The prompt asks for a tier; the deployment decides what fulfils it.
        model: modelForTier(request.model, {
          pro: config.model,
          flash: config.flashModel,
        }),
        messages: request.messages,
        stream: true,
        // A streamed call reports nothing about itself unless asked; with this
        // the final chunk carries the token counts and, where the provider
        // supports it, the cost.
        stream_options: { include_usage: true },
      }),
    });
    const model = modelForTier(request.model, {
      pro: config.model,
      flash: config.flashModel,
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      const error = `AI Gateway ${response.status}: ${detail.slice(0, 500)}`;
      config.onUsage?.(
        usageRecord({
          request,
          model,
          ms: Date.now() - started,
          user: config.user,
          error,
        }),
      );
      throw new Error(error);
    }
    const { text, usage } = await readSseDeltas(response.body, onDelta);
    config.onUsage?.(
      usageRecord({
        request,
        model,
        raw: usage,
        ms: Date.now() - started,
        user: config.user,
      }),
    );
    return text;
  };
}

/**
 * Consume an OpenAI-style SSE stream, forwarding each content delta and
 * returning the concatenated text.
 */
async function readSseDeltas(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
): Promise<{ text: string; usage?: RawUsage }> {
  let full = "";
  // Arrives in a chunk of its own at the end, after the last content delta,
  // and only because stream_options asked for it.
  let usage: RawUsage | undefined;
  for await (const { data } of readSse(body)) {
    if (data === "[DONE]") {
      continue;
    }
    let parsed: {
      choices?: { delta?: { content?: string } }[];
      usage?: RawUsage;
    };
    try {
      parsed = JSON.parse(data);
    } catch {
      // A non-JSON keepalive line is not fatal; skip it.
      continue;
    }
    if (parsed.usage) {
      usage = parsed.usage;
    }
    const content = parsed.choices?.[0]?.delta?.content;
    if (typeof content === "string" && content) {
      full += content;
      onDelta(content);
    }
  }
  return { text: full, usage };
}
