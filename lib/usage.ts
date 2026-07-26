import type { ModelTier } from "./models";
import type { ChatType, EntityId, MessageType } from "./types";

/**
 * What each model call cost, and enough context to ask why.
 *
 * Cost is not one number, it's a shape: it varies by which prompt ran, which
 * model answered it, how much history the prompt carried, and how far into the
 * game it happened. A single total can tell you the game is expensive; only the
 * breakdown can tell you that it's expensive because the character prompt grows
 * with the history and is never cached.
 *
 * Cached tokens are recorded separately from prompt tokens because they are
 * billed at a fraction of the rate, so a run where `cachedTokens` stays zero is
 * the signal that prompt caching isn't working — which it currently isn't, since
 * nothing sends cache_control (see TODO.md). This is how that gets noticed when
 * it changes, rather than assumed.
 *
 * Records are deliberately *not* story events. The log is the game's state and
 * gets replayed, exported and diffed; usage is bookkeeping about the machinery
 * that produced it, and mixing the two would make every checkpoint carry a
 * billing history.
 */

export interface UsageRecordType {
  /** ISO timestamp of when the call finished. */
  at: string;
  /** Wall-clock for the call, including the provider's queueing. */
  ms: number;
  /** Which prompt this was: "prompt Ama", "player input", ... */
  promptType: string;
  /** The entity the prompt was assembled for, when it was for one. */
  entity?: EntityId;
  /** The model that actually answered. */
  model: string;
  /** The tier the prompt asked for; see lib/models.ts. */
  tier?: ModelTier;
  /**
   * How many events were in the log when this prompt was assembled.
   *
   * The x-axis for "how does cost grow as the game goes on".
   */
  turn: number;
  /** How many history messages the prompt carried, beyond the system message. */
  historyTurns: number;
  promptTokens: number;
  completionTokens: number;
  /** Of `promptTokens`, how many were served from a prompt cache. */
  cachedTokens: number;
  /** USD, when the provider reports it. OpenRouter does; not everything does. */
  cost?: number;
  /** Verified identity, in server play. Absent when the game runs in a tab. */
  user?: string;
  /** Set instead of the token counts when the call failed. */
  error?: string;
}

/**
 * The usage shapes providers actually return.
 *
 * OpenAI-compatible everywhere, but the interesting fields are extensions:
 * `prompt_tokens_details.cached_tokens` for the cache hit, `cost` for what
 * OpenRouter charged. Read defensively — a provider that reports neither should
 * produce a record with zeros, not a crash on a billing detail.
 */
export interface RawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  cache_read_input_tokens?: number;
}

export function parseUsage(raw: RawUsage | undefined | null): {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cost?: number;
} {
  return {
    promptTokens: raw?.prompt_tokens ?? 0,
    completionTokens: raw?.completion_tokens ?? 0,
    cachedTokens:
      raw?.prompt_tokens_details?.cached_tokens ??
      raw?.cache_read_input_tokens ??
      0,
    ...(typeof raw?.cost === "number" ? { cost: raw.cost } : {}),
  };
}

/** History messages in a request — everything that isn't the system prompt. */
export function historyTurnsOf(messages: MessageType[]): number {
  return messages.filter((message) => message.role !== "system").length;
}

/** Build a record from a request and whatever the provider said about it. */
export function usageRecord({
  request,
  model,
  raw,
  ms,
  user,
  error,
}: {
  request: ChatType;
  model: string;
  raw?: RawUsage | null;
  ms: number;
  user?: string;
  error?: string;
}): UsageRecordType {
  return {
    at: new Date().toISOString(),
    ms,
    promptType: request.meta.title,
    ...(request.meta.entity ? { entity: request.meta.entity } : {}),
    model,
    ...(request.model ? { tier: request.model } : {}),
    turn: request.meta.turn ?? 0,
    historyTurns: request.meta.historyTurns ?? historyTurnsOf(request.messages),
    ...parseUsage(raw),
    ...(user ? { user } : {}),
    ...(error ? { error } : {}),
  };
}

export interface UsageTotals {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cost: number;
  ms: number;
  errors: number;
}

const EMPTY: UsageTotals = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  cachedTokens: 0,
  cost: 0,
  ms: 0,
  errors: 0,
};

export function totals(records: UsageRecordType[]): UsageTotals {
  return records.reduce<UsageTotals>(
    (sum, record) => ({
      calls: sum.calls + 1,
      promptTokens: sum.promptTokens + record.promptTokens,
      completionTokens: sum.completionTokens + record.completionTokens,
      cachedTokens: sum.cachedTokens + record.cachedTokens,
      cost: sum.cost + (record.cost ?? 0),
      ms: sum.ms + record.ms,
      errors: sum.errors + (record.error ? 1 : 0),
    }),
    { ...EMPTY },
  );
}

/** Totals per prompt type — which prompt the money actually goes to. */
export function byPromptType(
  records: UsageRecordType[],
): Record<string, UsageTotals> {
  const grouped: Record<string, UsageRecordType[]> = {};
  for (const record of records) {
    (grouped[record.promptType] ??= []).push(record);
  }
  return Object.fromEntries(
    Object.entries(grouped).map(([type, group]) => [type, totals(group)]),
  );
}

/**
 * Records as CSV, because the question "how does this grow" is a spreadsheet
 * question and nobody should have to write a parser to ask it.
 */
export const USAGE_COLUMNS = [
  "at",
  "turn",
  "promptType",
  "entity",
  "model",
  "tier",
  "historyTurns",
  "promptTokens",
  "cachedTokens",
  "completionTokens",
  "cost",
  "ms",
  "user",
  "error",
] as const;

export function toCsv(records: UsageRecordType[]): string {
  const escape = (value: unknown): string => {
    if (value === undefined || value === null) {
      return "";
    }
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = records.map((record) =>
    USAGE_COLUMNS.map((column) => escape(record[column])).join(","),
  );
  return [USAGE_COLUMNS.join(","), ...rows].join("\n");
}
