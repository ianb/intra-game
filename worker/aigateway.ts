import type { ChatStreamFn } from "../lib/game/model";
import { openAiCompatibleStream } from "./openaistream";
import type { UsageRecordType } from "../lib/usage";

/**
 * The LLM backend, talking to Cloudflare AI Gateway.
 *
 * AI Gateway fronts many providers behind one OpenAI-compatible endpoint, with
 * model ids in `provider/model` form (`anthropic/claude-4-5-sonnet`,
 * `openai/gpt-5.2`, `workers-ai/@cf/...`) — the same shape OpenRouter uses, so
 * the model ids the game already stores carry over either way.
 *
 * This runs server-side because the gateway token is ours, not the player's.
 *
 * No provider key is sent by default, and that is sufficient: with AI Gateway
 * Unified Billing the account's prepaid credit pays the provider, so
 * `cf-aig-authorization` both authenticates and settles the call. A gateway
 * with a stored BYOK key behaves the same way from here. A player who brought
 * their own key is the exception — it is passed through as `Authorization`, and
 * the gateway token then only identifies the account.
 *
 * The streaming, the SSE parsing and the usage accounting are in
 * ./openaistream.ts, shared with the OpenRouter backend.
 */

export interface GatewayConfig {
  accountId: string;
  /**
   * The gateway's name. Gateways are addressed by it, so it is part of the URL
   * rather than decoration.
   */
  gatewayId?: string;
  /** Our Cloudflare AI Gateway token. Never sent to the client. */
  token: string;
  model: string;
  flashModel?: string;
  reasoningEffort?: string;
  /** Dollars per million tokens; the gateway reports tokens but no price. */
  priceIn?: number;
  priceOut?: number;
  /** A player's own provider key, when they brought one. */
  providerKey?: string;
  onUsage?: (record: UsageRecordType) => void;
  user?: string;
}

/** Cloudflare's default when a gateway is created without a name. */
export const DEFAULT_GATEWAY_ID = "default";

/**
 * The gateway's OpenAI-compatible endpoint.
 *
 * This used to point at `api.cloudflare.com/.../ai/v1/chat/completions`, which
 * is Workers AI, not AI Gateway. Three things were wrong together and each hid
 * the others: that host wants `Authorization` rather than `cf-aig-authorization`,
 * it takes `@cf/...` model ids rather than `provider/model`, and it isn't a
 * gateway at all, so none of the logging or limits the gateway exists for would
 * have applied. Nothing caught it because no real call had ever been made — the
 * fake provider answers any URL.
 */
function endpoint(accountId: string, gatewayId: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat/chat/completions`;
}

export function gatewayChatStream(config: GatewayConfig): ChatStreamFn {
  const headers: Record<string, string> = {
    "cf-aig-authorization": `Bearer ${config.token}`,
  };
  if (config.providerKey) {
    headers.authorization = `Bearer ${config.providerKey}`;
  }
  return openAiCompatibleStream({
    endpoint: endpoint(
      config.accountId,
      config.gatewayId || DEFAULT_GATEWAY_ID,
    ),
    headers,
    model: config.model,
    flashModel: config.flashModel,
    reasoningEffort: config.reasoningEffort,
    priceIn: config.priceIn,
    priceOut: config.priceOut,
    label: "AI Gateway",
    onUsage: config.onUsage,
    user: config.user,
  });
}
