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
 * This runs server-side because the gateway token is ours, not the player's. A
 * player may supply their own provider key instead, which is passed through as
 * `Authorization` while the gateway token still identifies the account.
 *
 * The streaming, the SSE parsing and the usage accounting are in
 * ./openaistream.ts, shared with the OpenRouter backend.
 */

export interface GatewayConfig {
  accountId: string;
  /** Our Cloudflare AI Gateway token. Never sent to the client. */
  token: string;
  model: string;
  flashModel?: string;
  /** A player's own provider key, when they brought one. */
  providerKey?: string;
  onUsage?: (record: UsageRecordType) => void;
  user?: string;
}

function endpoint(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
}

export function gatewayChatStream(config: GatewayConfig): ChatStreamFn {
  const headers: Record<string, string> = {
    "cf-aig-authorization": `Bearer ${config.token}`,
  };
  if (config.providerKey) {
    headers.authorization = `Bearer ${config.providerKey}`;
  }
  return openAiCompatibleStream({
    endpoint: endpoint(config.accountId),
    headers,
    model: config.model,
    flashModel: config.flashModel,
    label: "AI Gateway",
    onUsage: config.onUsage,
    user: config.user,
  });
}
