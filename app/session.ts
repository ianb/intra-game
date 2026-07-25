import type { StreamingTagState } from "@/lib/game/model";
import { lastLlmError } from "@/lib/llm";
import { persistentSignal } from "@/lib/persistentsignal";
import { model } from "./model";
import { readSse } from "@/lib/ssestream";
import type { StoryEventType } from "@/lib/types";

/**
 * Talking to the session server.
 *
 * Server-side play splits a turn in two: `delta` events carry narrative text as
 * the model produces it (provisional, for display), and one `events` message
 * carries the authoritative story events that were appended to the session log.
 * The client shows the former and folds in the latter — stream for feel, events
 * for truth.
 *
 * The API is gated by Cloudflare Access, which the browser satisfies through its
 * normal session cookie, so requests just need `credentials: "include"`.
 */

export interface TurnHandlers {
  onDelta?: (state: StreamingTagState) => void;
  onEvents?: (events: StoryEventType[]) => void;
  onError?: (message: string) => void;
}

function api(path: string, session: string): string {
  return `/api/${path}?session=${encodeURIComponent(session)}`;
}

/**
 * Claim a session on the server.
 *
 * There is no owner to send: the server takes that from the Access-verified
 * identity on the request. `credentials: "include"` is what carries the Access
 * cookie.
 */
export async function createSession(session: string): Promise<void> {
  const response = await fetch(api("create", session), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`Could not create session: ${response.status}`);
  }
}

/** The session's events from a cursor — how a reconnecting client catches up. */
export async function fetchEvents(
  session: string,
  since = 0,
): Promise<{ total: number; events: StoryEventType[] }> {
  const response = await fetch(api("events", session) + `&since=${since}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Could not read session: ${response.status}`);
  }
  return (await response.json()) as { total: number; events: StoryEventType[] };
}

/** Play a turn, reporting text as it arrives and the events when it lands. */
export async function sendInput(
  session: string,
  text: string,
  handlers: TurnHandlers = {},
): Promise<StoryEventType[]> {
  const response = await fetch(api("input", session), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    const message = `Turn failed: ${response.status} ${detail.slice(0, 200)}`;
    handlers.onError?.(message);
    throw new Error(message);
  }
  let events: StoryEventType[] = [];
  for await (const message of readSse(response.body)) {
    if (message.event === "delta") {
      handlers.onDelta?.(JSON.parse(message.data) as StreamingTagState);
    } else if (message.event === "events") {
      events = JSON.parse(message.data) as StoryEventType[];
      handlers.onEvents?.(events);
    } else if (message.event === "error") {
      const { message: detail } = JSON.parse(message.data) as {
        message: string;
      };
      handlers.onError?.(detail);
    }
  }
  return events;
}

// --- Choosing where a turn runs ----------------------------------------------

/**
 * The server session to play in, or null to run the engine locally in this tab.
 *
 * Local play is the original mode and still works with a user's own OpenRouter
 * key. Setting a session id switches to server-side play, where the engine runs
 * in a Durable Object and this tab becomes a renderer.
 */
export const remoteSession = persistentSignal<string | null>(
  "remoteSession",
  null,
);

/**
 * Play one turn, wherever this game runs.
 *
 * The two modes differ only in who generates the events: locally the engine
 * produces them here; remotely the server does and this folds them in. Either
 * way they land in the same log and render the same way.
 */
export async function playTurn(text: string): Promise<string | undefined> {
  const session = remoteSession.value;
  if (!session) {
    return model.sendText(text);
  }
  try {
    await sendInput(session, text, {
      onDelta: (state) => {
        model.streaming.value = state;
      },
      onEvents: (events) => {
        model.streaming.value = null;
        model.appendRemoteEvents(events);
      },
      onError: (message) => {
        lastLlmError.value = message;
      },
    });
  } finally {
    model.streaming.value = null;
  }
  return undefined;
}

/**
 * Start play in whichever mode this tab is in.
 *
 * Locally that means launching the game here. Remotely it means adopting the
 * server's log — the client must not launch, because the server owns the
 * session and a local launch would duplicate its events and fire LLM calls this
 * tab isn't paying for.
 */
export async function initSession(): Promise<void> {
  const session = remoteSession.value;
  if (!session) {
    model.checkLaunch();
    return;
  }
  try {
    await createSession(session);
    const { events } = await fetchEvents(session);
    model.adoptRemoteLog(events);
  } catch (e) {
    lastLlmError.value = `Could not join session: ${String(e)}`;
  }
}
