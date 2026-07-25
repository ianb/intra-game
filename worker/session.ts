import { entities } from "../lib/game/gameobjs";
import { Model } from "../lib/game/model";
import type { StoryEventType } from "../lib/types";
import { gatewayChatStream } from "./aigateway";

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

export interface SessionEnv {
  CF_AIG_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  GATEWAY_MODEL?: string;
}

export class GameSession {
  private state: DurableObjectState;
  private env: SessionEnv;

  constructor(state: DurableObjectState, env: SessionEnv) {
    this.state = state;
    this.env = env;
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
   * Play a turn, streaming it back.
   *
   * The engine is rebuilt over the stored log, run, and the events it appended
   * are persisted. Narrative text is streamed to the client as it arrives (SSE
   * `delta` events) and the authoritative events follow (`events`), which is the
   * same split the client already understands: stream for feel, events for truth.
   */
  private async input(request: Request): Promise<Response> {
    const { text } = (await request.json()) as { text?: string };
    if (!text) {
      return json({ error: "missing text" }, 400);
    }
    if (!this.env.CF_ACCOUNT_ID || !this.env.CF_AIG_TOKEN) {
      return json({ error: "AI Gateway not configured" }, 503);
    }
    const credential = await this.state.storage.get<StoredCredential>(
      CREDENTIAL_KEY
    );
    const model = new Model(entities, {
      chatStream: gatewayChatStream({
        accountId: this.env.CF_ACCOUNT_ID,
        token: this.env.CF_AIG_TOKEN,
        model: this.env.GATEWAY_MODEL ?? "anthropic/claude-4-5-haiku",
        providerKey: credential?.key,
      }),
    });

    const log = await this.log();
    model.replaceLog(log);
    const before = model.updates.value.length;

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (event: string, data: unknown) =>
      writer.write(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      );

    // Mirror provisional narrative text to the client as the engine receives it.
    const stopWatching = watchStreaming(model, (state) => {
      void send("delta", state);
    });

    // Run the turn in the background so the response can start streaming now.
    // waitUntil keeps the DO alive until the log is written.
    const turn = (async () => {
      try {
        await model.sendText(text);
        while (model.runningSignal.value) {
          await new Promise((r) => setTimeout(r, 10));
        }
        const appended = model.updates.value.slice(before);
        if (appended.length) {
          await this.append(appended);
        }
        await send("events", appended);
      } catch (e) {
        await send("error", { message: String(e) });
      } finally {
        stopWatching();
        await writer.close();
      }
    })();
    this.state.waitUntil(turn);

    return new Response(readable, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      },
    });
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

/** Report the in-flight narrative tag whenever it changes. */
function watchStreaming(
  model: Model,
  onChange: (state: unknown) => void
): () => void {
  let last: unknown = null;
  const timer = setInterval(() => {
    const current = model.streaming.value;
    if (current !== last) {
      last = current;
      if (current) {
        onChange(current);
      }
    }
  }, 30);
  return () => clearInterval(timer);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
