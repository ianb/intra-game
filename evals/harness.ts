import { Model } from "../lib/game/model";
import type { StoryEventType } from "../lib/types";
import { forkGame, settle } from "../playtest/fork";
import { totals, type UsageRecordType, type UsageTotals } from "../lib/usage";

/**
 * Running a scenario against a model and scoring what came back.
 *
 * The question these evals answer is narrow on purpose: **can this model drive
 * this game?** Not whether its prose is good — that needs a judge and a taste
 * argument — but whether it speaks the tag protocol well enough that the engine
 * can act on what it says, and whether the game reaches the state the scenario
 * was aiming at.
 *
 * Both halves are objective, which is what makes a recorded number worth
 * comparing across models and across months.
 */

/** One thing that either happened or didn't, after a scenario ran. */
export interface Check {
  name: string;
  /** What a failure would mean — this is what a reader of the results sees. */
  describe: string;
  run(result: RunResult): boolean;
}

export interface Scenario {
  name: string;
  describe: string;
  seed: number;
  inputs: string[];
  checks: Check[];
  /**
   * A checkpoint to start from instead of a new game.
   *
   * Without this every scenario pays for intake before it can test anything
   * else, which puts the later two thirds of the game out of reach: the model
   * calls to walk there cost more than the thing being measured, and a failure
   * anywhere on the way looks like a failure of whatever you were testing.
   */
  from?: string;
}

/**
 * Warnings the engine recovered from, rather than dropping something.
 *
 * A mismatched closing tag is sloppy markup the parser repairs and carries on
 * from; the game still happens. Everything else in the engine's warning
 * vocabulary means it threw something away. Unrecognised warnings count as
 * dropped, so a new failure mode shows up as a failure rather than being
 * silently forgiven.
 */
const REPAIRED = [/^Mismatched closing tag/];

export function classifyWarnings(warnings: string[]): {
  repaired: string[];
  dropped: string[];
} {
  const repaired: string[] = [];
  const dropped: string[] = [];
  for (const warning of warnings) {
    (REPAIRED.some((p) => p.test(warning)) ? repaired : dropped).push(warning);
  }
  return { repaired, dropped };
}

/** One thing the player typed, and everything the game did in response. */
export interface Turn {
  input: string;
  events: StoryEventType[];
}

export interface RunResult {
  model: Model;
  log: StoryEventType[];
  /**
   * The log split by player input.
   *
   * A single turn can produce several events — asking to look at something
   * routes through one prompt that decides what kind of input it was and a
   * second that answers it, so the first event carries no actions of its own.
   * Judging "did anything happen" per event would score that as a dead turn;
   * per turn is what the player actually experiences.
   */
  turns: Turn[];
  /**
   * What the engine complained about while folding the model's output.
   *
   * The engine already warns when a model breaks the protocol — an unparseable
   * `<set>`, a `character=` that names nobody, an exit that doesn't exist. Those
   * warnings are the protocol score, rather than a list of valid tags kept here
   * and drifting out of step with the engine that actually enforces them.
   */
  warnings: string[];
  /** Wall-clock for the whole scenario, including model latency. */
  ms: number;
  /** Set when the run threw; every check then counts as failed. */
  error?: string;
}

export interface CheckResult {
  name: string;
  describe: string;
  passed: boolean;
}

export interface ScenarioResult {
  scenario: string;
  passed: number;
  total: number;
  /**
   * Which prompts this was measured against; see playtest/fingerprint.ts.
   *
   * Recorded per scenario rather than per file because results are merged at
   * scenario granularity — running one scenario today must not relabel this
   * morning's rows as having been measured against today's prompts. Optional
   * because results recorded before this existed don't have one.
   */
  promptFingerprint?: string;
  ms: number;
  events: number;
  /** Warnings where the engine discarded something the model said. */
  dropped: string[];
  /** Warnings where it repaired sloppy markup and carried on. */
  repaired: string[];
  /**
   * What the characters said, so a failed text check can be audited later.
   *
   * Without this a result like "broke character" is unfalsifiable after the
   * run: the model is sampling, so it may not reproduce, and there would be no
   * way to tell a real failure from a check matching something innocent.
   */
  transcript: string[];
  /**
   * What this scenario actually cost, when the backend reports it.
   *
   * The reason it is here: choosing a model on price meant extrapolating from a
   * probe, and reasoning models made that wrong by a factor of four — they emit
   * thousands of invisible thinking tokens, billed at the output rate, that no
   * token estimate can see. A score without a price is half an answer.
   */
  usage?: UsageTotals;
  error?: string;
  checks: CheckResult[];
}

/**
 * Capture what the engine warns about, so protocol failures can be counted.
 *
 * console.warn is the engine's existing channel for "the model said something I
 * could not use" — see lib/game/tags.ts. Intercepting it means the eval learns
 * about new failure modes as the engine grows them.
 */
function captureWarnings(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((a) => String(a)).join(" "));
  };
  return {
    warnings,
    restore: () => {
      console.warn = original;
    },
  };
}

/** Play a scenario to the end and score it. */
export async function runScenario(
  scenario: Scenario,
  chat: Model["chat"],
  usage?: UsageRecordType[],
): Promise<ScenarioResult> {
  const started = Date.now();
  // Warnings are captured around the fork as well as the run: replaying a
  // checkpoint folds every event in it, and a checkpoint that no longer folds
  // cleanly is exactly the kind of rot worth failing on.
  const captured = captureWarnings();
  const turns: Turn[] = [];
  let error: string | undefined;
  // Undefined only if the fork itself threw — a missing or unreadable
  // checkpoint — in which case every check counts as failed below and this is
  // never read.
  let model: Model | undefined;
  let restoreRandom: () => void = () => undefined;

  try {
    const fork = await forkGame({
      chat,
      from: scenario.from,
      seed: scenario.seed,
    });
    model = fork.model;
    restoreRandom = fork.restore;
    for (const input of scenario.inputs) {
      const before = model.updates.value.length;
      await model.sendText(input);
      await settle(model);
      turns.push({ input, events: model.updates.value.slice(before) });
    }
  } catch (e) {
    error = String(e);
  } finally {
    captured.restore();
    restoreRandom();
  }

  const result: RunResult = {
    model: model!,
    log: model?.updates.value ?? [],
    turns,
    warnings: captured.warnings,
    ms: Date.now() - started,
    error,
  };

  const checks = scenario.checks.map((check) => ({
    name: check.name,
    describe: check.describe,
    // A run that threw scores zero rather than being scored on partial state.
    passed: error === undefined && safely(() => check.run(result)),
  }));

  const { repaired, dropped } = classifyWarnings(result.warnings);
  return {
    scenario: scenario.name,
    passed: checks.filter((c) => c.passed).length,
    total: checks.length,
    ms: result.ms,
    events: result.log.length,
    dropped: [...new Set(dropped)],
    repaired: [...new Set(repaired)],
    transcript: transcriptOf(result),
    ...(usage?.length ? { usage: totals(usage) } : {}),
    error,
    checks,
  };
}

/** A check that throws is a failed check, not a failed eval run. */
function safely(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

/** Every line of dialogue in the run, attributed, for auditing failures. */
function transcriptOf(result: RunResult): string[] {
  return result.log
    .flatMap((event) => event.actions)
    .flatMap((action) =>
      "text" in action && action.text
        ? [`${"id" in action ? action.id : "narrator"}: ${action.text}`]
        : [],
    );
}
