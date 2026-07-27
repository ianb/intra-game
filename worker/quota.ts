/**
 * What one player is allowed to spend.
 *
 * The gateway has a total cap, which bounds the bill but not who consumes it:
 * the first enthusiastic stranger can spend the month's allowance in an
 * afternoon and everyone else, including the owner, gets a dead site until it
 * resets. A total cap turns an unbounded-money problem into a
 * denial-of-service problem. This is the other half.
 *
 * Spending is per identity and per period, which is a rolling window rather
 * than a calendar month — a calendar month means everyone's budget refills at
 * midnight on the 1st and the site falls over every month on the same day.
 *
 * Two deliberate holes:
 *
 * - A player using their own provider key isn't counted. They are not spending
 *   the deployment's money, and metering them would be charging rent on their
 *   own key.
 * - A turn is checked before it starts and never interrupted. A turn is three
 *   or four model calls and stopping between them leaves the story mid-sentence
 *   with the log already written, so the last turn of a budget is allowed to go
 *   over. The overshoot is bounded by one turn, which is fractions of a cent.
 */

/** Dollars per player per period, when nothing says otherwise. */
export const DEFAULT_LIMIT_USD = 1;
/** The rolling window spending is measured over. */
export const DEFAULT_PERIOD_MS = 30 * 24 * 60 * 60_000;

export interface QuotaState {
  /** Dollars spent inside the current window. */
  spent: number;
  /** When the window opened, as an ISO timestamp. */
  since: string;
}

export interface QuotaVerdict {
  allowed: boolean;
  spent: number;
  limit: number;
  /** When the window rolls over, so the client can say when to come back. */
  resets: string;
  /** Shown to the player. Empty when allowed. */
  message: string;
}

export interface QuotaConfig {
  limit: number;
  periodMs: number;
}

export function quotaConfig(env: {
  QUOTA_USD?: string;
  QUOTA_PERIOD_DAYS?: string;
}): QuotaConfig {
  const limit = Number(env.QUOTA_USD);
  const days = Number(env.QUOTA_PERIOD_DAYS);
  return {
    // A malformed or negative value falls back rather than disabling the
    // quota: "QUOTA_USD=abc" should not silently mean unlimited.
    limit: Number.isFinite(limit) && limit >= 0 ? limit : DEFAULT_LIMIT_USD,
    periodMs:
      Number.isFinite(days) && days > 0
        ? days * 24 * 60 * 60_000
        : DEFAULT_PERIOD_MS,
  };
}

/** A fresh window opening now. */
export function newWindow(now: number): QuotaState {
  return { spent: 0, since: new Date(now).toISOString() };
}

/**
 * The state to use for a decision at this moment, rolling the window if it has
 * expired. Pure, so both the check and the increment agree on when a window
 * ended rather than each deciding separately.
 */
export function currentWindow(
  state: QuotaState | undefined,
  config: QuotaConfig,
  now: number,
): QuotaState {
  if (!state) {
    return newWindow(now);
  }
  const started = Date.parse(state.since);
  if (!Number.isFinite(started) || now - started >= config.periodMs) {
    return newWindow(now);
  }
  return state;
}

export function verdict(
  state: QuotaState,
  config: QuotaConfig,
  now: number,
): QuotaVerdict {
  const resets = new Date(
    Date.parse(state.since) + config.periodMs,
  ).toISOString();
  // A limit of 0 is "no server play for anyone", which is a legitimate thing to
  // configure and must not be confused with "unset".
  const allowed = state.spent < config.limit;
  return {
    allowed,
    spent: round(state.spent),
    limit: config.limit,
    resets,
    message: allowed
      ? ""
      : `You've used your $${config.limit.toFixed(2)} of server play. ` +
        `It resets on ${resets.slice(0, 10)}. ` +
        `You can keep playing in this tab with your own model key.`,
  };
}

/** Add a call's cost to the window. */
export function spend(
  state: QuotaState,
  amount: number,
  config: QuotaConfig,
  now: number,
): QuotaState {
  const current = currentWindow(state, config, now);
  // Costs arrive from a provider's usage report and are occasionally absent or
  // nonsense; a NaN here would silently disable the quota from then on.
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  return { ...current, spent: round(current.spent + safe) };
}

/** Keep stored totals from accumulating float noise across thousands of calls. */
function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
