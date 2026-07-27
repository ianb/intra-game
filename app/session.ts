import type { StreamingTagState } from "@/lib/game/model";
import { lastLlmError } from "@/lib/llm";
import { persistentSignal } from "@/lib/persistentsignal";
import { lastTurnInput, lastTurnLength } from "@/lib/game/rewind";
import { checkpointFromUrl, loadCheckpoint } from "./checkpoints";
import { model } from "./model";
import { readSse } from "@/lib/ssestream";
import type { StoryEventType } from "@/lib/types";
import type { UsageRecordType } from "@/lib/usage";

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

// --- Who the server thinks you are -------------------------------------------

export interface AuthState {
  /** Which identity source this deployment uses. */
  mode: "access" | "google" | "dev" | "none";
  /** The verified address, or null when signed out. */
  email: string | null;
  /** Where to send the browser to sign in, when that's a thing here. */
  loginUrl: string | null;
}

/**
 * Ask the server who this is.
 *
 * Outside the API gate on purpose: a signed-out client has to be able to ask,
 * or it can't know to offer a sign-in. It answers with an identity and never a
 * credential.
 *
 * A deployment with no identity source at all answers `none`, which is the
 * local-play case — there is no server to sign in to and nothing to show.
 */
export async function fetchAuth(): Promise<AuthState> {
  try {
    const response = await fetch("/api/auth", { credentials: "include" });
    if (!response.ok) {
      return { mode: "none", email: null, loginUrl: null };
    }
    return (await response.json()) as AuthState;
  } catch {
    return { mode: "none", email: null, loginUrl: null };
  }
}

/** Sign in, coming back to where the player was. */
export function signIn(loginUrl: string): void {
  const next = window.location.pathname + window.location.search;
  window.location.href = `${loginUrl}?next=${encodeURIComponent(next)}`;
}

export function signOut(): void {
  const next = window.location.pathname + window.location.search;
  window.location.href = `/auth/logout?next=${encodeURIComponent(next)}`;
}

// --- The player's games on the server ----------------------------------------

export interface ServerSession {
  id: string;
  title: string;
  created: string;
  /** How far along it is; read from the game itself, not a cached count. */
  events: number;
}

/**
 * Every game this identity has on the server.
 *
 * Sessions were always addressable — a game's Durable Object is named after the
 * verified email and the session id — but nothing kept a list, and a DO
 * namespace can't be enumerated. So one game per browser, and clearing the id
 * lost it. The server keeps the list now; see worker/sessionindex.ts.
 */
export async function listServerSessions(): Promise<ServerSession[]> {
  const response = await fetch("/api/sessions", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Could not list games: ${response.status}`);
  }
  return ((await response.json()) as { sessions: ServerSession[] }).sessions;
}

/** Start a new game on the server and switch this tab to it. */
export async function newServerSession(title?: string): Promise<ServerSession> {
  const response = await fetch("/api/sessions", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error || `Could not start a game: ${response.status}`);
  }
  return ((await response.json()) as { session: ServerSession }).session;
}

export async function renameServerSession(
  id: string,
  title: string,
): Promise<void> {
  const response = await fetch("/api/sessions", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, title, rename: true }),
  });
  if (!response.ok) {
    throw new Error(`Could not rename: ${response.status}`);
  }
}

/**
 * Delete a game on the server, for good.
 *
 * The log and any stored credential go with it. If it's the game this tab is
 * playing, the tab drops back to local play rather than sitting on an id that
 * now addresses an empty session.
 */
export async function deleteServerSession(id: string): Promise<void> {
  const response = await fetch(
    `/api/sessions?session=${encodeURIComponent(id)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(`Could not delete: ${response.status}`);
  }
  if (remoteSession.value === id) {
    remoteSession.value = null;
  }
}

/** What this server session has spent; see lib/usage.ts. */
export async function fetchServerUsage(
  session: string,
): Promise<UsageRecordType[]> {
  const response = await fetch(api("usage", session), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Could not read usage: ${response.status}`);
  }
  return ((await response.json()) as { usage: UsageRecordType[] }).usage;
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
 * Undo the last turn, wherever this game runs.
 *
 * Locally that is a direct call on the model. Remotely it has to go through the
 * same path as a turn: the server owns the log, and a client that appends its
 * own rewind marker would hide a turn the server still believes in — they would
 * disagree on the next move, and a reload would bring the undone turn back.
 *
 * Returns what the player typed on the undone turn, which the input box puts
 * back so they can rephrase. That is read from the local mirror of the log in
 * both modes, because the client has it either way.
 */
export async function undoTurn(): Promise<string> {
  const text = lastTurnInput(model.liveUpdates.value);
  if (!remoteSession.value) {
    return model.undo();
  }
  if (!text && !lastTurnLength(model.liveUpdates.value)) {
    return "";
  }
  await playTurn("/undo");
  return text;
}

/** Undo the last turn and immediately replay it, so a reroll is one click. */
export async function redoTurn(): Promise<void> {
  const text = await undoTurn();
  if (text) {
    await playTurn(text);
  }
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
    // ?checkpoint=briefed drops straight into a recorded state, so a link can
    // point at a specific part of the game. Only in local play: in a server
    // session the log belongs to the server, and loading one here would put the
    // two out of step.
    const checkpoint = checkpointFromUrl();
    if (checkpoint) {
      try {
        await loadCheckpoint(checkpoint);
        return;
      } catch (e) {
        lastLlmError.value = String(e);
      }
    }
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
