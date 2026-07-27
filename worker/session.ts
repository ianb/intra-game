import { effect } from "@preact/signals-core";
import { entities } from "../lib/game/content";
import { Model } from "../lib/game/model";
import { DEFAULT_FLASH_MODEL } from "../lib/models";
import type { StoryEventType } from "../lib/types";
import type { UsageRecordType } from "../lib/usage";
import { gatewayChatStream } from "./aigateway";
import { openRouterChatStream } from "./openrouter";
import { devChatStream } from "./devllm";
import { SessionLog } from "./eventlog";
import type { QuotaVerdict } from "./quota";

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

/** How the router tells a session who the Access-verified caller is. */
export const OWNER_HEADER = "x-intra-owner";

const OWNER_KEY = "owner";
/**
 * Usage records, one key per call, ordered like the event log.
 *
 * Deliberately not in the log: the log is the game and gets replayed, exported
 * and checkpointed, and billing history has no business riding along in it.
 */
const USAGE_PREFIX = "usage:";
const USAGE_DIGITS = 8;
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
  /** The gateway's name, which is part of its URL. Defaults to "default". */
  CF_GATEWAY_ID?: string;
  GATEWAY_MODEL?: string;
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
  /**
   * Per-player spending, enforced against the DO in PLAYER_SESSIONS.
   *
   * Absent when a deployment has no player index — the local development and
   * test paths construct this DO directly — in which case there is nothing to
   * meter against and play is unmetered.
   */
  PLAYER_SESSIONS?: DurableObjectNamespace;
}

export class GameSession {
  private state: DurableObjectState;
  private env: SessionEnv;
  private sessionLog: SessionLog;

  constructor(state: DurableObjectState, env: SessionEnv) {
    this.state = state;
    this.env = env;
    this.sessionLog = new SessionLog(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    switch (`${request.method} ${url.pathname}`) {
      case "POST /create":
        return this.create(request);
      case "GET /events":
        return this.events(url);
      case "GET /info":
        return json({ events: await this.sessionLog.count() });
      case "GET /usage":
        return json({ usage: await this.readUsage() });
      case "POST /destroy":
        return this.destroy();
      case "POST /input":
        return this.input(request);
      default:
        return json({ error: "not found" }, 404);
    }
  }

  /** Claim this session for an owner, optionally storing their own API key. */
  private async create(request: Request): Promise<Response> {
    // The owner comes from the header the router sets from the Access-verified
    // identity, never from the body: a client that could name its own owner
    // would be writing the audit trail it is supposed to be recorded in.
    const email = request.headers.get(OWNER_HEADER);
    if (!email) {
      return json({ error: "unidentified" }, 401);
    }
    const owner: SessionOwner = { email };
    const body = (await request.json().catch(() => ({}))) as {
      credential?: StoredCredential;
    };
    await this.state.storage.put(OWNER_KEY, owner);
    if (body.credential) {
      await this.state.storage.put(CREDENTIAL_KEY, body.credential);
    }
    return json({ owner, events: await this.sessionLog.count() });
  }

  /** The player's DO, or null where this deployment has no index. */
  private playerStub(email: string) {
    const ns = this.env.PLAYER_SESSIONS;
    if (!ns) {
      return null;
    }
    return ns.get(ns.idFromName(email));
  }

  /**
   * May this player spend? Null means there is nothing to ask.
   *
   * A quota service that cannot be reached does not block play. The failure
   * mode of guessing wrong here is asymmetric: refusing wrongly locks a player
   * out of a game they are entitled to, while allowing wrongly costs one turn
   * and is caught by the next check.
   */
  private async checkQuota(email: string): Promise<QuotaVerdict | null> {
    const stub = this.playerStub(email);
    if (!stub) {
      return null;
    }
    try {
      const response = await stub.fetch("https://player/quota");
      return response.ok ? ((await response.json()) as QuotaVerdict) : null;
    } catch (e) {
      console.warn("Could not read quota", e);
      return null;
    }
  }

  /** Report what a call cost, so the next check sees it. */
  private async recordSpend(email: string, cost: number): Promise<void> {
    const stub = this.playerStub(email);
    if (!stub || !cost) {
      return;
    }
    try {
      await stub.fetch("https://player/quota/spend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cost }),
      });
    } catch (e) {
      // Same rule as the usage log: bookkeeping never fails a turn.
      console.warn("Could not record spend", e);
    }
  }

  /**
   * Record a call: to this session's usage log, and to the player's budget.
   *
   * One place, because the three backends each report usage and each of them
   * would otherwise have to remember to meter it. A backend added later gets
   * both for free.
   *
   * A call made on the player's own key is logged but not metered — `user` is
   * still stamped, so the accounting stays complete either way.
   */
  private noteUsage(record: UsageRecordType, metered: boolean): void {
    void this.writeUsage(record);
    if (metered && record.user && record.cost) {
      void this.recordSpend(record.user, record.cost);
    }
  }

  /** Every usage record for this session, oldest first. */
  private async readUsage(): Promise<UsageRecordType[]> {
    const stored = await this.state.storage.list<UsageRecordType>({
      prefix: USAGE_PREFIX,
    });
    return [...stored.values()];
  }

  /**
   * Append a usage record.
   *
   * Keyed by count so the order is the order the calls happened. A lost record
   * is a hole in the accounting and nothing worse, so this never fails a turn:
   * the player's game matters more than the bookkeeping about it.
   */
  private async writeUsage(record: UsageRecordType): Promise<void> {
    try {
      const existing = await this.state.storage.list({ prefix: USAGE_PREFIX });
      const key = `${USAGE_PREFIX}${String(existing.size).padStart(USAGE_DIGITS, "0")}`;
      await this.state.storage.put({ [key]: record });
    } catch (e) {
      console.warn("Could not record usage", e);
    }
  }

  /**
   * Delete this session outright.
   *
   * Not a hole in "the log is append-only": that invariant is about editing
   * history — an undo appends a rewind marker rather than removing a turn, so
   * the record of what happened stays honest. Throwing a whole game away at its
   * owner's request is a different act, and the alternative is worse: a deleted
   * game that still bills storage and still holds whatever the player said in
   * it, forever, because nothing can reach it.
   *
   * Credentials go with it, which is most of the point.
   */
  private async destroy(): Promise<Response> {
    await this.state.storage.deleteAll();
    return json({ destroyed: true });
  }

  /** The event log from a cursor, so a reconnecting client can catch up. */
  private async events(url: URL): Promise<Response> {
    const since = Number(url.searchParams.get("since") ?? "0") || 0;
    // Reads only what the client is missing, rather than the whole game.
    const events = await this.sessionLog.read(since);
    return json({ since, total: await this.sessionLog.count(), events });
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
    const credential =
      await this.state.storage.get<StoredCredential>(CREDENTIAL_KEY);
    // Whose turn this is, recorded with what it cost. Read from stored
    // ownership rather than the request, which is the same rule the log
    // follows: a client that could name its own user would be writing the
    // record it is meant to appear in.
    const owner = await this.state.storage.get<SessionOwner>(OWNER_KEY);

    // Checked once, before the turn starts. A turn is three or four model calls
    // and stopping between them would leave the story mid-sentence with the log
    // already written, so the last turn of a budget is allowed to run over. The
    // overshoot is one turn, which is fractions of a cent.
    //
    // A player on their own key is not metered: they aren't spending the
    // deployment's money.
    if (!credential?.key && owner?.email) {
      const quota = await this.checkQuota(owner.email);
      if (quota && !quota.allowed) {
        return json({ error: quota.message, quota }, 429);
      }
    }

    const backend = this.chatBackend(credential, owner?.email);
    if (!backend) {
      return json(
        {
          error:
            "No model backend configured — set OPENROUTER_API_KEY, or " +
            "CF_ACCOUNT_ID and CF_AIG_TOKEN, or DEV_FAKE_LLM",
        },
        503,
      );
    }
    const model = new Model(entities, { chatStream: backend });

    const log = await this.sessionLog.read();
    model.replaceLog(log);
    const before = model.updates.value.length;

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (event: string, data: unknown) =>
      writer.write(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
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
          await this.sessionLog.append(appended);
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

  /** The LLM backend: AI Gateway, or the local stand-in in development. */
  private chatBackend(credential: StoredCredential | undefined, user?: string) {
    // A player on their own key spends their own money, so it isn't metered.
    const metered = !credential?.key;
    if (this.env.DEV_FAKE_LLM) {
      return devChatStream({
        user,
        fakeCost: this.env.DEV_FAKE_COST,
        onUsage: (record) => {
          this.noteUsage(record, metered);
        },
      });
    }
    // OpenRouter before the gateway: a deployment sets gateway credentials and
    // nothing else, so this branch is only reached when someone has explicitly
    // asked for it — which is the dev case.
    if (this.env.OPENROUTER_API_KEY) {
      return openRouterChatStream({
        apiKey: this.env.OPENROUTER_API_KEY,
        endpoint: this.env.OPENROUTER_BASE_URL,
        model: this.env.GATEWAY_MODEL ?? DEFAULT_FLASH_MODEL,
        flashModel: this.env.GATEWAY_FLASH_MODEL,
        providerKey: credential?.key,
        user,
        onUsage: (record) => {
          this.noteUsage(record, metered);
        },
      });
    }
    if (!this.env.CF_ACCOUNT_ID || !this.env.CF_AIG_TOKEN) {
      return null;
    }
    return gatewayChatStream({
      accountId: this.env.CF_ACCOUNT_ID,
      gatewayId: this.env.CF_GATEWAY_ID,
      token: this.env.CF_AIG_TOKEN,
      model: this.env.GATEWAY_MODEL ?? DEFAULT_FLASH_MODEL,
      flashModel: this.env.GATEWAY_FLASH_MODEL,
      providerKey: credential?.key,
      user,
      onUsage: (record) => {
        this.noteUsage(record, metered);
      },
    });
  }
}

/**
 * Report the in-flight narrative tag whenever it changes.
 *
 * This subscribes rather than polls. Polling looked adequate but wasn't: at any
 * sampling interval most intermediate states are missed, and because the engine
 * runs several prompts per turn a sample can land on a *later* prompt's earlier
 * state — so content appeared to go backwards, which a typewriter UI would
 * render as text deleting itself. An effect fires synchronously on every change,
 * so deltas arrive complete and in order.
 */
function watchStreaming(
  model: Model,
  onChange: (state: unknown) => void,
): () => void {
  return effect(() => {
    const current = model.streaming.value;
    if (current) {
      onChange(current);
    }
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
