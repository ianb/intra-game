import type { ChatStreamFn } from "../lib/game/model";
import type { ChatType } from "../lib/types";
import { usageRecord, type UsageRecordType } from "../lib/usage";

/**
 * A stand-in LLM for local development and functional tests.
 *
 * The point is that the server can be exercised end to end — routing, the
 * Durable Object, the event log, SSE framing — with no Cloudflare account, no
 * API key and no network. It produces well-formed protocol output, not good
 * writing; it is for testing plumbing, never for playing.
 */
export interface DevChatOptions {
  onUsage?: (record: UsageRecordType) => void;
  /** Dollars per call, for exercising the quota offline. Off unless set. */
  fakeCost?: string;
  user?: string;
}

export function devChatStream(options: DevChatOptions = {}): ChatStreamFn {
  return async (request: ChatType, onDelta: (delta: string) => void) => {
    const started = Date.now();
    const response = cannedResponse(request);
    // Deliberately chunked mid-tag, so the streaming parser's chunk-boundary
    // handling is exercised rather than bypassed.
    for (let i = 0; i < response.length; i += 7) {
      onDelta(response.slice(i, i + 7));
      await new Promise((r) => setTimeout(r, 5));
    }
    // Usage too, so the recording path — storage, the endpoint, the display —
    // can be exercised offline. Token counts are estimated from the text, which
    // is honest enough to be useful. Cost is absent and the model is named
    // "dev": a fabricated price that looked real would be worse than no price
    // at all.
    //
    // Except when asked for one. Per-player quotas are enforced on cost, so
    // with no cost there is no way to exercise them without spending money,
    // and an untested limit is not a limit. DEV_FAKE_COST is opt-in for that,
    // and still reports as model "dev" so nothing downstream can mistake it
    // for a real price.
    const fakeCost = Number(options.fakeCost);
    options.onUsage?.(
      usageRecord({
        request,
        model: "dev",
        raw: {
          prompt_tokens: Math.round(
            request.messages.reduce((n, m) => n + m.content.length, 0) / 4,
          ),
          completion_tokens: Math.round(response.length / 4),
          ...(Number.isFinite(fakeCost) && fakeCost > 0
            ? { cost: fakeCost }
            : {}),
        },
        ms: Date.now() - started,
        user: options.user,
      }),
    );
    return response;
  };
}

function cannedResponse(request: ChatType): string {
  const title = request.meta.title;
  if (title === "player input") {
    // The player's turn is interpreted, not answered.
    const last = request.messages.at(-1)?.content ?? "";
    const typed = /`([^`]*)`/.exec(last)?.[1] ?? "hello";
    return `<dialog character="You">${escapeText(typed)}</dialog>`;
  }
  if (title === "player examine") {
    return `<description minutes="1">A developer-mode room, sketched in low detail.</description>`;
  }
  return `<dialog character="Ama" to="PLAYER">This is developer mode; I am not really thinking.</dialog>`;
}

function escapeText(s: string): string {
  return s.replace(/[<>]/g, " ").slice(0, 200);
}
