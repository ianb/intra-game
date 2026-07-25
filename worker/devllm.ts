import type { ChatStreamFn } from "../lib/game/model";
import type { ChatType } from "../lib/types";

/**
 * A stand-in LLM for local development and functional tests.
 *
 * The point is that the server can be exercised end to end — routing, the
 * Durable Object, the event log, SSE framing — with no Cloudflare account, no
 * API key and no network. It produces well-formed protocol output, not good
 * writing; it is for testing plumbing, never for playing.
 */
export function devChatStream(): ChatStreamFn {
  return async (request: ChatType, onDelta: (delta: string) => void) => {
    const response = cannedResponse(request);
    // Deliberately chunked mid-tag, so the streaming parser's chunk-boundary
    // handling is exercised rather than bypassed.
    for (let i = 0; i < response.length; i += 7) {
      onDelta(response.slice(i, i + 7));
      await new Promise((r) => setTimeout(r, 5));
    }
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
