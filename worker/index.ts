import { accessConfig, authenticate } from "./access";
import { OWNER_HEADER } from "./session";
import { MAX_SESSIONS, type SessionSummary } from "./sessionindex";

export { GameSession } from "./session";
export { PlayerSessions } from "./sessionindex";

/**
 * The game server.
 *
 * Static assets (the client bundle) are served by Cloudflare directly; this
 * Worker handles `/api/*` only, and its job is to authenticate the caller and
 * route them to their session's Durable Object. Game state and execution live
 * in that DO — see worker/session.ts.
 *
 * Two namespaces: one Durable Object per game (GAME_SESSION), and one per
 * player (PLAYER_SESSIONS) holding the list of their games, because a DO
 * namespace cannot be enumerated. Both are addressed by the Access-verified
 * email, never by anything the client sends.
 */

export interface Env {
  GAME_SESSION: DurableObjectNamespace;
  PLAYER_SESSIONS: DurableObjectNamespace;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** AI Gateway credentials; never sent to the client. */
  CF_AIG_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  CF_GATEWAY_ID?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const api = url.pathname.startsWith("/api/");

    // The site is gated whenever Access is configured, not only the API.
    //
    // Access normally stops a request before it reaches the Worker, so this is
    // usually redundant — but only if the Access application covers the whole
    // hostname. Scope it to /api/* by accident and the game, the transcript and
    // /evals/ go public with no error to notice, which is not a property that
    // should live in one dashboard field. Configuring Access is the statement
    // "this is private", and the Worker now enforces it either way.
    //
    // Deliberately keyed on Access being configured rather than on a separate
    // flag. A deployment without Access is the local-play case — the engine
    // runs in the player's browser on their own key, there is nothing to
    // protect, and requiring a login to serve a static bundle would break the
    // way this is meant to be runnable.
    const gated = accessConfig(env) !== null;
    if (!api && !gated) {
      return env.ASSETS.fetch(request);
    }

    const auth = await authenticate(request, env);
    if (!auth.ok) {
      return auth.response;
    }
    if (!api) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/sessions") {
      return sessions(request, env, auth.email);
    }

    // A session id is supplied by the client; the DO name is scoped by the
    // verified identity so one user cannot address another's session.
    const sessionId = url.searchParams.get("session");
    if (!sessionId) {
      return new Response("Missing session", { status: 400 });
    }

    // Joining a session lists it, which is what keeps the index honest: a
    // session started before the index existed, or held only in a bookmark,
    // appears the first time it is used rather than staying invisible.
    if (request.method === "POST" && url.pathname === "/api/create") {
      await index(env, auth.email, "POST", "/register", { id: sessionId });
    }

    // Forward to the DO, rewriting /api/<action> to /<action>. The identity
    // rides along as a header so the DO records who owns a session without
    // knowing anything about Access — and without taking the client's word for
    // it, which is what it used to do.
    const inner = new URL(request.url);
    inner.pathname = url.pathname.replace(/^\/api/, "");
    const forwarded = new Request(inner, request);
    forwarded.headers.set(OWNER_HEADER, auth.email);
    return game(env, auth.email, sessionId).fetch(forwarded);
  },
};

function game(env: Env, email: string, sessionId: string) {
  const name = `${email}:${sessionId}`;
  return env.GAME_SESSION.get(env.GAME_SESSION.idFromName(name));
}

/** Call the caller's session index. Named by email alone — one per player. */
async function index(
  env: Env,
  email: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const stub = env.PLAYER_SESSIONS.get(env.PLAYER_SESSIONS.idFromName(email));
  return stub.fetch(`https://sessions${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
}

/**
 * The player's games: list, start, rename, delete.
 *
 * Everything here is scoped to the verified email by construction — the index
 * is named after it, and a game's DO name is derived from it — so there is no
 * ownership check to forget. A session id from another player's browser
 * addresses a *different, empty* game rather than theirs.
 */
async function sessions(
  request: Request,
  env: Env,
  email: string,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const listed = (await (await index(env, email, "GET", "/list")).json()) as {
      sessions: SessionSummary[];
    };
    // Event counts come from the games themselves rather than being cached
    // here. It is one subrequest per game on a request a player makes rarely,
    // and a cached count is a count that can be wrong — which, for "which of
    // these is the game I was playing", is the only thing that matters.
    const sessions = await Promise.all(
      listed.sessions.slice(0, MAX_SESSIONS).map(async (session) => {
        const info = await game(env, email, session.id).fetch(
          "https://session/info",
        );
        const { events } = info.ok
          ? ((await info.json()) as { events: number })
          : { events: 0 };
        return { ...session, events };
      }),
    );
    return json({ sessions });
  }

  if (request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      id?: string;
      rename?: boolean;
    };
    if (body.rename) {
      if (!body.id || !body.title) {
        return json({ error: "missing id or title" }, 400);
      }
      return index(env, email, "POST", "/rename", {
        id: body.id,
        title: body.title,
      });
    }
    // Ids are minted here rather than by the client: nothing is riding on them
    // being unguessable (the DO name includes the email either way), but "start
    // a new game" shouldn't need the client to invent anything.
    const id = crypto.randomUUID();
    return index(env, email, "POST", "/register", { id, title: body.title });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("session");
    if (!id) {
      return json({ error: "missing session" }, 400);
    }
    // Forget it first: if the wipe fails the game is at worst orphaned, whereas
    // the reverse order can leave a listed game whose storage is already gone.
    const forgotten = (await (
      await index(env, email, "DELETE", "/forget", { id })
    ).json()) as { forgotten: boolean };
    await game(env, email, id).fetch("https://session/destroy", {
      method: "POST",
    });
    return json(forgotten);
  }

  return json({ error: "method not allowed" }, 405);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
