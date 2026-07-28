import type { ChatStreamFn } from "../lib/game/model";
import { readSse } from "../lib/ssestream";
import { modelForTier } from "../lib/models";
import { usageRecord, type RawUsage, type UsageRecordType } from "../lib/usage";
import type { ChatType } from "../lib/types";

/**
 * Streaming chat against any OpenAI-compatible endpoint.
 *
 * Cloudflare AI Gateway and OpenRouter differ only in where they live and which
 * header authenticates them; the request body, the SSE framing, the delta
 * shape and the usage chunk are the same. Keeping one implementation means a
 * fix to the stream parsing or the usage accounting can't land in one backend
 * and not the other, which is the kind of drift that shows up as "it works in
 * dev".
 */

export interface StreamConfig {
  /** Full URL of the chat-completions endpoint. */
  endpoint: string;
  /** Sent with every request, on top of content-type. */
  headers: Record<string, string>;
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
  /**
   * How hard the model should think, where it takes direction.
   *
   * Worth setting rather than leaving to the default: gpt-5.4-nano scored
   * 21/26 at its own default and 25/26 at "medium", for a third of the latency
   * a heavier model needs to match it. See evals/RESULTS.md.
   */
  reasoningEffort?: string;
  /** Names this backend in error messages. */
  label: string;
  /** Called once per completed call with what it cost; see lib/usage.ts. */
  onUsage?: (record: UsageRecordType) => void;
  /** Stamped onto usage records — the Access-verified caller. */
  user?: string;
  /**
   * Ask for what the call cost, using OpenRouter's extension.
   *
   * Off by default because it is an extension, not the OpenAI API: AI Gateway
   * validates parameters strictly and answers an unknown one with
   * `400 Unknown parameter: 'usage'`, which is a turn that doesn't happen. Only
   * the OpenRouter backend sets it.
   */
  costFromProvider?: boolean;
  /**
   * Dollars per million tokens, for a backend that reports tokens but no price.
   *
   * AI Gateway does work out what a call cost — it is in the gateway's logs and
   * analytics, computed from the same token counts — but it reports that to its
   * dashboard, not to the caller. Checked against a real gateway rather than
   * inferred from the docs: a live request returns no `cf-aig-*` header at all.
   * `cf-aig-custom-cost` goes the other way, telling the gateway your negotiated
   * rate for its own records.
   *
   * The quota decision happens inline, before a turn starts, so it needs a
   * number now. Without one it would meter every turn at zero and never stop
   * anyone — a limit that silently isn't one, which is worse than no limit,
   * because the configuration says it is protected.
   *
   * So this is for enforcement, and the gateway's own figures remain the
   * record. Keep them in step: if these are wrong the quota is wrong, and the
   * dashboard will not agree with it.
   */
  priceIn?: number;
  priceOut?: number;
}

/**
 * Fill in what a call cost, when the provider didn't say and the prices are
 * configured. Reasoning tokens are billed at the output rate and are already
 * counted inside completionTokens, so they need no separate term.
 */
export function withCost<
  T extends Pick<UsageRecordType, "promptTokens" | "completionTokens" | "cost">,
>(record: T, config: Pick<StreamConfig, "priceIn" | "priceOut">): T {
  if (record.cost !== undefined || !config.priceIn || !config.priceOut) {
    return record;
  }
  const cost =
    (record.promptTokens * config.priceIn +
      record.completionTokens * config.priceOut) /
    1e6;
  return { ...record, cost: Math.round(cost * 1e6) / 1e6 };
}

/**
 * A `ChatStreamFn`: reports text deltas as they arrive and resolves to the
 * complete response, so the engine's authoritative parse is unchanged.
 */
export function openAiCompatibleStream(config: StreamConfig): ChatStreamFn {
  return async (request: ChatType, onDelta: (delta: string) => void) => {
    const started = Date.now();
    const model = modelForTier(request.model, {
      pro: config.model,
      flash: config.flashModel,
    });
    const record = (extra: { raw?: RawUsage; error?: string }) => {
      const built = usageRecord({
        request,
        model,
        ms: Date.now() - started,
        user: config.user,
        ...extra,
      });
      config.onUsage?.(withCost(built, config));
    };

    let response: Response;
    try {
      response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...config.headers },
        body: JSON.stringify({
          messages: request.messages,
          model,
          stream: true,
          // A streamed call reports nothing about itself unless asked. The
          // first gets token counts in a final chunk; the second is
          // OpenRouter's extension that adds what it charged.
          // Standard OpenAI, and where token counts come from on both backends.
          stream_options: { include_usage: true },
          ...(config.costFromProvider ? { usage: { include: true } } : {}),
          ...(config.reasoningEffort
            ? { reasoning: { effort: config.reasoningEffort } }
            : {}),
        }),
      });
    } catch (e) {
      // A network failure still cost time and still needs to appear in the
      // record, or a flaky provider looks like a game that simply stopped.
      const error = `${config.label} unreachable: ${String(e)}`;
      record({ error });
      throw new Error(error);
    }

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      const error = `${config.label} ${response.status}: ${detail.slice(0, 500)}`;
      record({ error });
      throw new Error(error);
    }
    const { text, usage } = await readSseDeltas(response.body, onDelta);
    record({ raw: usage });
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
