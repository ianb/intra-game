/**
 * The list of a player's games.
 *
 * Sessions were always addressable — a session's Durable Object is named
 * `${email}:${sessionId}`, so any number of them can exist per player — but
 * nothing kept a list, and a Durable Object namespace cannot be enumerated:
 * `idFromName` is one-way, and there is no "give me every session for this
 * email". A player therefore had exactly one game, whichever id their browser
 * happened to be holding, and clearing that id lost the game rather than
 * leaving it.
 *
 * So one small Durable Object per verified identity, whose whole job is
 * remembering which sessions exist. It holds no game state and no credentials:
 * losing it would lose the *menu*, not anyone's game, and a session it forgot
 * is still there under its own name.
 *
 * The list is a single stored value, which is the shape the event log
 * deliberately moved away from. The reasoning differs because the data does: a
 * log grows without bound and is appended to every turn, while this holds one
 * short row per game a person has started and is rewritten only when they start
 * or delete one.
 */

export interface SessionSummary {
  id: string;
  title: string;
  /** ISO date, for ordering and for showing how old a game is. */
  created: string;
}

/** The part of Durable Object storage this needs; see eventlog.ts for why. */
export interface IndexStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
}

const SESSIONS_KEY = "sessions";
/** Enough for any real player, and a bound on what one request can fan out to. */
export const MAX_SESSIONS = 50;

export class SessionIndex {
  constructor(private storage: IndexStorage) {}

  async list(): Promise<SessionSummary[]> {
    return (await this.storage.get<SessionSummary[]>(SESSIONS_KEY)) ?? [];
  }

  /**
   * Record a session, if it isn't already recorded.
   *
   * Idempotent, and called whenever a client joins a session rather than only
   * when one is created. That makes the index self-healing: a session from
   * before this existed, or one whose id someone kept in a bookmark, gets listed
   * the first time it is used instead of staying invisible forever.
   */
  async register(
    id: string,
    title?: string,
    now = new Date(),
  ): Promise<SessionSummary> {
    const sessions = await this.list();
    const existing = sessions.find((session) => session.id === id);
    if (existing) {
      return existing;
    }
    if (sessions.length >= MAX_SESSIONS) {
      throw new Error(
        `That's ${MAX_SESSIONS} games — delete one before starting another`,
      );
    }
    const summary: SessionSummary = {
      id,
      title: title?.trim() || `Game ${sessions.length + 1}`,
      created: now.toISOString().slice(0, 10),
    };
    await this.storage.put({ [SESSIONS_KEY]: [...sessions, summary] });
    return summary;
  }

  async rename(id: string, title: string): Promise<SessionSummary | null> {
    const sessions = await this.list();
    const found = sessions.find((session) => session.id === id);
    if (!found || !title.trim()) {
      return null;
    }
    const renamed = sessions.map((session) =>
      session.id === id ? { ...session, title: title.trim() } : session,
    );
    await this.storage.put({ [SESSIONS_KEY]: renamed });
    return { ...found, title: title.trim() };
  }

  /**
   * Forget a session.
   *
   * Only removes it from the list — deleting the game itself is the caller's
   * job, because the log lives in a different Durable Object and this one has no
   * way to reach it. Returns whether it was listed, so the caller can tell
   * "deleted" from "there was nothing there".
   */
  async forget(id: string): Promise<boolean> {
    const sessions = await this.list();
    const remaining = sessions.filter((session) => session.id !== id);
    if (remaining.length === sessions.length) {
      return false;
    }
    await this.storage.put({ [SESSIONS_KEY]: remaining });
    return true;
  }
}

/** The Durable Object wrapper; the logic above is what's worth testing. */
export class PlayerSessions {
  private index: SessionIndex;

  constructor(private state: DurableObjectState) {
    this.index = new SessionIndex(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = ["POST", "DELETE"].includes(request.method)
      ? ((await request.json().catch(() => ({}))) as {
          id?: string;
          title?: string;
        })
      : {};
    switch (`${request.method} ${url.pathname}`) {
      case "GET /list":
        return json({ sessions: await this.index.list() });
      case "POST /register":
        if (!body.id) {
          return json({ error: "missing id" }, 400);
        }
        try {
          return json({
            session: await this.index.register(body.id, body.title),
          });
        } catch (e) {
          return json(
            { error: String(e instanceof Error ? e.message : e) },
            409,
          );
        }
      case "POST /rename": {
        if (!body.id || !body.title) {
          return json({ error: "missing id or title" }, 400);
        }
        const renamed = await this.index.rename(body.id, body.title);
        return renamed
          ? json({ session: renamed })
          : json({ error: "no such session" }, 404);
      }
      case "DELETE /forget":
        if (!body.id) {
          return json({ error: "missing id" }, 400);
        }
        return json({ forgotten: await this.index.forget(body.id) });
      default:
        return json({ error: "not found" }, 404);
    }
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
