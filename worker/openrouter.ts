import type { ChatStreamFn } from "../lib/game/model";
import { openAiCompatibleStream } from "./openaistream";
import type { UsageRecordType } from "../lib/usage";

/**
 * The LLM backend, talking to OpenRouter directly.
 *
 * The practical backend for developing the server path: OpenRouter is already
 * what browser play uses, so the key is one you have, and it needs no
 * Cloudflare account, no AI Gateway and no deployment. Model ids are the same
 * `provider/model` strings the gateway takes, so switching between the two
 * changes nothing else about the game.
 *
 * A player's own key wins over the server's when they've supplied one, which is
 * the point of storing it: their session, their spend.
 */

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterConfig {
  /** The server's key. A player's own key, if present, is used instead. */
  apiKey: string;
  model: string;
  flashModel?: string;
  reasoningEffort?: string;
  /** A player's own OpenRouter key, when they brought one. */
  providerKey?: string;
  /**
   * Override the endpoint.
   *
   * Exists so the streaming path can be exercised against a local stand-in —
   * this is the one part of the server that otherwise cannot be tested without
   * spending money at a real provider.
   */
  endpoint?: string;
  onUsage?: (record: UsageRecordType) => void;
  user?: string;
}

export function openRouterChatStream(config: OpenRouterConfig): ChatStreamFn {
  return openAiCompatibleStream({
    endpoint: config.endpoint || DEFAULT_ENDPOINT,
    headers: {
      authorization: `Bearer ${config.providerKey || config.apiKey}`,
      "x-title": "Intra",
    },
    model: config.model,
    flashModel: config.flashModel,
    reasoningEffort: config.reasoningEffort,
    label: "OpenRouter",
    // OpenRouter reports what it charged when asked; nothing else does.
    costFromProvider: true,
    onUsage: config.onUsage,
    user: config.user,
  });
}
