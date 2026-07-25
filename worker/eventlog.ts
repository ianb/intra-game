import { STORAGE_VERSION } from "../lib/storage";
import type { StoryEventType } from "../lib/types";

/**
 * A session's event log, on Durable Object storage.
 *
 * The log is stored one event per key, ordered by a zero-padded index. It used
 * to be a single value rewritten on every append, which is wrong in two ways
 * for something that only ever grows: every turn re-serialized and re-wrote the
 * entire history — quadratic in the length of the game — and the whole thing had
 * to keep fitting inside one storage value's size cap.
 *
 * Per-event keys make an append proportional to what is being appended, and let
 * a reconnecting client read from a cursor instead of pulling the whole game.
 *
 * This is deliberately a class over a narrow storage interface rather than
 * methods on the Durable Object: the index arithmetic, the batching and the
 * migration are the parts most likely to be subtly wrong, and this way they can
 * be tested against a plain Map. See test/eventlog.doctest.md.
 */

/** The part of Durable Object storage a log needs. */
export interface LogStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T>(options: {
    prefix?: string;
    start?: string;
  }): Promise<Map<string, T>>;
}

const EVENT_PREFIX = "event:";
const EVENT_DIGITS = 8;
/**
 * Storage takes at most 128 pairs per put; two slots are kept, for the count
 * and the version stamp.
 */
const PUT_BATCH = 126;
/** Cached length, so a cursor read can report a total without reading the log. */
const COUNT_KEY = "logCount";
/** The single-value log this replaced. Read once per session, then migrated. */
const LEGACY_LOG_KEY = "log";
/** What wrote this session; see lib/storage.ts. Absent means "before stamps". */
const VERSION_KEY = "storageVersion";

/** Zero-padded so storage's lexicographic order is the order events happened. */
export function eventKey(index: number): string {
  return `${EVENT_PREFIX}${String(index).padStart(EVENT_DIGITS, "0")}`;
}

export class SessionLog {
  constructor(private storage: LogStorage) {}

  /** The log from `since` onward; the whole thing by default. */
  async read(since = 0): Promise<StoryEventType[]> {
    await this.migrateLegacy();
    const stored = await this.storage.list<StoryEventType>({
      prefix: EVENT_PREFIX,
      start: since > 0 ? eventKey(since) : undefined,
    });
    return [...stored.values()];
  }

  /** How many events there are, without reading them. */
  async count(): Promise<number> {
    await this.migrateLegacy();
    return (await this.storage.get<number>(COUNT_KEY)) ?? 0;
  }

  /** Append events. The only mutation of the log there is. */
  async append(events: StoryEventType[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.migrateLegacy();
    await this.checkVersion();
    await this.write(events, (await this.storage.get<number>(COUNT_KEY)) ?? 0);
  }

  /**
   * Refuse to touch a session written by a newer build.
   *
   * Workers roll out gradually and a Durable Object outlives any one of them,
   * so an older worker can be handed a session a newer one has already written.
   * Appending to it with the old understanding of the shape is how a log gets
   * quietly corrupted; failing the request is recoverable, and the client
   * retries into a newer worker.
   *
   * Sessions from before stamps existed need nothing done to them: their shape
   * is the one this version reads (migrateLegacy has just ensured that), and
   * the write below stamps them on the way past.
   */
  private async checkVersion(): Promise<void> {
    const stored = await this.storage.get<number>(VERSION_KEY);
    if (stored !== undefined && stored > STORAGE_VERSION) {
      throw new Error(
        `Session was written by storage version ${stored}, but this worker ` +
          `understands ${STORAGE_VERSION}`,
      );
    }
  }

  /** What wrote this session, or 0 for one that predates version stamps. */
  async version(): Promise<number> {
    return (await this.storage.get<number>(VERSION_KEY)) ?? 0;
  }

  /**
   * Write events starting at an index, in batches storage will accept.
   *
   * The count goes in the same put as the events it counts, so a batch either
   * lands whole or not at all — a count that ran ahead of the events would make
   * the log look longer than it is to every later read.
   */
  private async write(events: StoryEventType[], from: number): Promise<void> {
    for (let i = 0; i < events.length; i += PUT_BATCH) {
      const batch = events.slice(i, i + PUT_BATCH);
      const record: Record<string, unknown> = {};
      batch.forEach((event, offset) => {
        record[eventKey(from + i + offset)] = event;
      });
      record[COUNT_KEY] = from + i + batch.length;
      // Stamped in the same put as the events, for the same reason the count
      // is: a version written separately could land without them, or they
      // without it, and either way the session lies about what it holds.
      record[VERSION_KEY] = STORAGE_VERSION;
      await this.storage.put(record);
    }
  }

  /**
   * Move a session written by the single-value scheme over to per-event keys.
   *
   * Cheap to leave in: one `get` of a key that is absent in every session
   * created since. Removing it means older sessions silently read as empty —
   * the log would still be sitting there under a key nothing looks at.
   */
  private async migrateLegacy(): Promise<void> {
    const legacy = await this.storage.get<StoryEventType[]>(LEGACY_LOG_KEY);
    if (legacy === undefined) {
      return;
    }
    // Written before the delete: a crash between them replays the migration,
    // which is harmless, while the reverse order would lose the log.
    await this.write(legacy, 0);
    await this.storage.delete(LEGACY_LOG_KEY);
  }
}
