import type { ChatStreamFn } from "../lib/game/model";
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
  /** Default model id, in `provider/model` form. */
  model: string;
  /** A player's own provider key, when they brought one. */
  providerKey?: string;
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
        model: config.model,
        messages: request.messages,
        stream: true,
      }),
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      throw new Error(`AI Gateway ${response.status}: ${detail.slice(0, 500)}`);
    }
    return readSseDeltas(response.body, onDelta);
  };
}

/**
 * Consume an OpenAI-style SSE stream, forwarding each content delta and
 * returning the concatenated text.
 */
async function readSseDeltas(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    // SSE events are separated by a blank line; a chunk may split one.
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const event = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const delta = contentDelta(event);
      if (delta) {
        full += delta;
        onDelta(delta);
      }
      sep = buffer.indexOf("\n\n");
    }
  }
  return full;
}

/** Pull the content delta out of one SSE event, ignoring anything else. */
function contentDelta(event: string): string {
  let text = "";
  for (const line of event.split("\n")) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") {
      continue;
    }
    try {
      const parsed = JSON.parse(data) as {
        choices?: { delta?: { content?: string } }[];
      };
      const content = parsed.choices?.[0]?.delta?.content;
      if (typeof content === "string") {
        text += content;
      }
    } catch {
      // A partial or non-JSON keepalive line is not fatal; skip it.
    }
  }
  return text;
}
