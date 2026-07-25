import type { StoryEventType } from "../lib/types";

/**
 * One game session: its event log, and the execution that appends to it.
 *
 * A Durable Object is the right shape here because a session is exactly one
 * world with one append-only log, and DOs serialize requests — so two turns can
 * never interleave and corrupt the stream.
 *
 * Two invariants this file exists to hold:
 *
 * 1. **The log is append-only.** It is both the game state and the audit
 *    record; undo appends a rewind marker rather than deleting (see
 *    lib/game/rewind.ts). Nothing here removes events.
 * 2. **Credentials never enter the log.** A player may supply their own API key
 *    for their session. That is stored under a separate storage key and must
 *    never be written into a StoryEventType, because the log is meant to be
 *    exportable and mineable for evals.
 */

const LOG_KEY = "log";
const OWNER_KEY = "owner";
/** Deliberately separate from the log; see invariant 2 above. */
const CREDENTIAL_KEY = "credential";

export interface SessionOwner {
  /** Verified identity from Cloudflare Access. */
  email: string;
}

export interface StoredCredential {
  /** Which upstream the player's own key is for, when they supplied one. */
  provider: "openrouter";
  key: string;
}

export class GameSession {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    switch (`${request.method} ${url.pathname}`) {
      case "POST /create":
        return this.create(request);
      case "GET /events":
        return this.events(url);
      case "POST /input":
        return this.input(request);
      default:
        return json({ error: "not found" }, 404);
    }
  }

  /** Claim this session for an owner, optionally storing their own API key. */
  private async create(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      owner: SessionOwner;
      credential?: StoredCredential;
    };
    await this.state.storage.put(OWNER_KEY, body.owner);
    if (body.credential) {
      await this.state.storage.put(CREDENTIAL_KEY, body.credential);
    }
    const log = await this.log();
    return json({ owner: body.owner, events: log.length });
  }

  /** The event log from a cursor, so a reconnecting client can catch up. */
  private async events(url: URL): Promise<Response> {
    const since = Number(url.searchParams.get("since") ?? "0") || 0;
    const log = await this.log();
    return json({ since, total: log.length, events: log.slice(since) });
  }

  /**
   * Play a turn.
   *
   * NOT YET IMPLEMENTED: this is where the engine runs. It should construct a
   * Model over the stored log with a streaming backend pointed at AI Gateway,
   * stream narrative deltas to the client over SSE, then append the resulting
   * events to the log. Returning 501 rather than a fake result so this can't be
   * mistaken for a working endpoint.
   */
  private async input(_request: Request): Promise<Response> {
    return json({ error: "turn execution not implemented yet" }, 501);
  }

  private async log(): Promise<StoryEventType[]> {
    return (await this.state.storage.get<StoryEventType[]>(LOG_KEY)) ?? [];
  }

  /** Append events. The only mutation of the log there is. */
  async append(events: StoryEventType[]): Promise<void> {
    const log = await this.log();
    await this.state.storage.put(LOG_KEY, [...log, ...events]);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
