import type { ChatStreamFn } from "../lib/game/model";
import { DEFAULT_FLASH_MODEL } from "../lib/models";
import type { UsageRecordType } from "../lib/usage";
import { gatewayChatStream } from "./aigateway";
import { openRouterChatStream } from "./openrouter";
import { devChatStream } from "./devllm";

/**
 * Everything the model backends read from the environment.
 *
 * Separate from SessionEnv, and deliberately free of Cloudflare types, so
 * `pnpm smoke` can build a backend from a plain object outside a Worker.
 */
export interface BackendEnv {
  CF_AIG_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  /** The gateway's name, which is part of its URL. Defaults to "default". */
  CF_GATEWAY_ID?: string;
  GATEWAY_MODEL?: string;
  /** minimal | low | medium | high, for models that take direction on it. */
  GATEWAY_REASONING?: string;
  /**
   * Dollars per million tokens for GATEWAY_MODEL.
   *
   * AI Gateway reports tokens but not price, and the quota is in dollars, so
   * without these every turn meters at zero and the limit never fires.
   */
  GATEWAY_PRICE_IN?: string;
  GATEWAY_PRICE_OUT?: string;
  /** Optional cheaper model for prompts that ask for the "flash" tier. */
  GATEWAY_FLASH_MODEL?: string;
  /**
   * Talk to OpenRouter directly instead of AI Gateway.
   *
   * The practical way to develop the server path: no Cloudflare account, no
   * gateway, and the same key browser play already uses.
   */
  OPENROUTER_API_KEY?: string;
  /** Point OpenRouter at a stand-in; see worker/openrouter.ts. */
  OPENROUTER_BASE_URL?: string;
  /** Local development: use the stand-in LLM instead of AI Gateway. */
  DEV_FAKE_LLM?: string;
  /** Dollars per fake call, so the quota can be exercised without spending. */
  DEV_FAKE_COST?: string;
}

/**
 * Which model backend a set of environment variables asks for.
 *
 * Lifted out of the session so something other than a live game can build the
 * same one. That "something" is `pnpm smoke`, and it exists because two request
 * parameters reached a real provider without a single test having called one:
 * every test in this repo answers with a fake that accepts any body. A backend
 * chosen by a copy of this logic would not have been the same backend, so the
 * check has to share the function rather than resemble it.
 */
export function chooseBackend(
  env: BackendEnv,
  opts: {
    /** A player's own key, when they brought one. */
    providerKey?: string;
    user?: string;
    onUsage?: (record: UsageRecordType) => void;
  } = {},
): ChatStreamFn | null {
  const { providerKey, user, onUsage } = opts;
  if (env.DEV_FAKE_LLM) {
    return devChatStream({ user, fakeCost: env.DEV_FAKE_COST, onUsage });
  }
  // OpenRouter before the gateway: a deployment sets gateway credentials and
  // nothing else, so this branch is only reached when someone has explicitly
  // asked for it — which is the dev case.
  if (env.OPENROUTER_API_KEY) {
    return openRouterChatStream({
      apiKey: env.OPENROUTER_API_KEY,
      endpoint: env.OPENROUTER_BASE_URL,
      model: env.GATEWAY_MODEL ?? DEFAULT_FLASH_MODEL,
      flashModel: env.GATEWAY_FLASH_MODEL,
      reasoningEffort: env.GATEWAY_REASONING,
      providerKey,
      user,
      onUsage,
    });
  }
  if (!env.CF_ACCOUNT_ID || !env.CF_AIG_TOKEN) {
    return null;
  }
  return gatewayChatStream({
    accountId: env.CF_ACCOUNT_ID,
    gatewayId: env.CF_GATEWAY_ID,
    token: env.CF_AIG_TOKEN,
    model: env.GATEWAY_MODEL ?? DEFAULT_FLASH_MODEL,
    flashModel: env.GATEWAY_FLASH_MODEL,
    reasoningEffort: env.GATEWAY_REASONING,
    priceIn: Number(env.GATEWAY_PRICE_IN) || undefined,
    priceOut: Number(env.GATEWAY_PRICE_OUT) || undefined,
    providerKey,
    user,
    onUsage,
  });
}

/** What `chooseBackend` would pick, for logs and error messages. */
export function backendName(env: BackendEnv): string {
  if (env.DEV_FAKE_LLM) {
    return "the development stand-in";
  }
  if (env.OPENROUTER_API_KEY) {
    return "OpenRouter";
  }
  if (env.CF_ACCOUNT_ID && env.CF_AIG_TOKEN) {
    return `AI Gateway (${env.CF_GATEWAY_ID ?? "default"})`;
  }
  return "nothing";
}

export const NO_BACKEND =
  "No model backend configured — set OPENROUTER_API_KEY, or " +
  "CF_ACCOUNT_ID and CF_AIG_TOKEN, or DEV_FAKE_LLM";
