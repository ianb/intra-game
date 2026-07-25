import { authenticate } from "./access";
import { OWNER_HEADER } from "./session";

export { GameSession } from "./session";

/**
 * The game server.
 *
 * Static assets (the client bundle) are served by Cloudflare directly; this
 * Worker handles `/api/*` only, and its job is to authenticate the caller and
 * route them to their session's Durable Object. Game state and execution live
 * in that DO — see worker/session.ts.
 */

export interface Env {
  GAME_SESSION: DurableObjectNamespace;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** AI Gateway credentials; never sent to the client. */
  CF_AIG_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const auth = await authenticate(request, env);
    if (!auth.ok) {
      return auth.response;
    }

    // A session id is supplied by the client; the DO name is scoped by the
    // verified identity so one user cannot address another's session.
    const sessionId = url.searchParams.get("session");
    if (!sessionId) {
      return new Response("Missing session", { status: 400 });
    }
    const name = `${auth.email}:${sessionId}`;
    const stub = env.GAME_SESSION.get(env.GAME_SESSION.idFromName(name));

    // Forward to the DO, rewriting /api/<action> to /<action>. The identity
    // rides along as a header so the DO records who owns a session without
    // knowing anything about Access — and without taking the client's word for
    // it, which is what it used to do.
    const inner = new URL(request.url);
    inner.pathname = url.pathname.replace(/^\/api/, "");
    const forwarded = new Request(inner, request);
    forwarded.headers.set(OWNER_HEADER, auth.email);
    return stub.fetch(forwarded);
  },
};
