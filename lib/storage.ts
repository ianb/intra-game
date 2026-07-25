/**
 * A version stamp on everything the game stores.
 *
 * Three places hold a game: the browser's live log, browser save slots, and a
 * Durable Object's per-session log. None of them recorded what shape they were
 * written in, which means a future change to the stored shape has no way to
 * tell an old payload from a new one — it can only guess from the contents, and
 * guessing wrong corrupts someone's game silently.
 *
 * The one migration that already exists shows the problem: the Durable Object
 * moved from a single `log` value to one key per event, and it detects that by
 * the *presence of the old key*. That worked because the two shapes happened to
 * use different key names. It would not have worked for a change to the shape of
 * an event, which is the far likelier next change.
 *
 * So: a number, written alongside the data, checked on the way back in.
 *
 * This is storage versioning only. What an event *means* — a renamed entity, a
 * retired tag — is a separate problem with a separate home in
 * lib/game/migrate.ts, and one that has to be solved per change rather than by a
 * counter.
 */

/**
 * Bump when the stored *shape* changes, and add a step to the migration in
 * whichever module owns that store.
 *
 * 0 is not a value anything writes: it's what an unstamped payload is treated
 * as, which is everything written before this existed.
 */
export const STORAGE_VERSION = 1;

/** Payload as stored: the data, plus what wrote it. */
export interface Versioned<T> {
  version: number;
  value: T;
}

export function stamp<T>(value: T): Versioned<T> {
  return { version: STORAGE_VERSION, value };
}

/** What `read` found, so a caller can tell "old" from "impossible". */
export type ReadResult<T> =
  | { ok: true; value: T; from: number }
  | { ok: false; from: number; reason: string };

function isVersioned(raw: unknown): raw is Versioned<unknown> {
  return (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as Versioned<unknown>).version === "number" &&
    "value" in raw
  );
}

/**
 * Unwrap a stored payload, bringing older shapes forward.
 *
 * `migrate` is called once per version step, so a store with three historical
 * shapes writes three small functions rather than one that has to know every
 * combination.
 *
 * A payload from a *newer* version is refused rather than migrated backwards or
 * read hopefully. There is no way to know what a future shape means, and a
 * half-understood save is worse than a refused one — this happens to real
 * people, who open an old tab after the game has been redeployed.
 */
export function read<T>(
  raw: unknown,
  migrate: (value: unknown, from: number) => unknown = (value) => value,
): ReadResult<T> {
  const from = isVersioned(raw) ? raw.version : 0;
  let value = isVersioned(raw) ? raw.value : raw;
  if (from > STORAGE_VERSION) {
    return {
      ok: false,
      from,
      reason:
        `stored by version ${from}, but this build understands ${STORAGE_VERSION} — ` +
        `it was probably written by a newer version of the game`,
    };
  }
  for (let step = from; step < STORAGE_VERSION; step++) {
    value = migrate(value, step);
  }
  return { ok: true, value: value as T, from };
}
