import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { ChatFn } from "../lib/game/model";
import { cliChat } from "../playtest/clichat";
import { promptFingerprint } from "../playtest/fingerprint";
import { runScenario, type ScenarioResult } from "./harness";
import { openRouterChat } from "./openrouter";
import type { ModelRun, ResultsFile } from "./page";
import { writeReports, RESULTS_DIR, SUMMARY, PAGE } from "./report";
import { EVAL_SCENARIOS } from "./scenarios";

/**
 * Run the eval scenarios against one or more models and record the results.
 *
 *     pnpm evals                                  # the default models, cli backend
 *     pnpm evals --model claude-haiku-4-5-20251001
 *     pnpm evals --backend openrouter --model anthropic/claude-haiku-4.5
 *     pnpm evals --scenario intake
 *
 * Results land in evals/results/<date>.yaml and are rolled up into
 * evals/RESULTS.md and evals/index.html. All three are committed: the point of
 * an eval you can't rerun cheaply is the record it leaves.
 *
 * YAML rather than JSON because these files are read in diffs as much as by
 * machines — a transcript comes out as a block scalar instead of one long line
 * with escaped newlines, so a changed reply shows up as a changed line.
 */

function parseArgs(argv: string[]) {
  const args: Record<string, string[]> = {};
  let key = "";
  for (const token of argv) {
    if (token.startsWith("--")) {
      key = token.slice(2);
      args[key] ??= [];
    } else if (key) {
      args[key]!.push(token);
    }
  }
  return args;
}

function backendFor(
  name: string,
  model: string,
  flashModel?: string,
  reasoningEffort?: string,
): ChatFn {
  if (name === "openrouter") {
    return openRouterChat({ model, flashModel, reasoningEffort });
  }
  if (name === "cli") {
    return cliChat({ model, flashModel });
  }
  throw new Error(`Unknown backend "${name}" (expected cli or openrouter)`);
}

/**
 * Fold a run into whatever is already recorded for the day.
 *
 * Running one scenario, or one model, must not throw away the rest of the day's
 * record — `--scenario mystery` used to leave a results file claiming that was
 * the only thing ever measured. New results win where they overlap; everything
 * else is left alone.
 */
/**
 * What makes two rows the same run.
 *
 * The model *pair*, not the model: scoring one big model against big+small is
 * the whole point of `--flash`, and keying on the pro model alone made the
 * second run silently replace the first — so the one comparison this feature
 * exists to support was the one it couldn't record.
 */
function runKey(run: ModelRun): string {
  return `${run.model}::${run.flashModel ?? ""}::${run.reasoning ?? ""}`;
}

function merge(path: string, runs: ModelRun[]): ModelRun[] {
  if (!existsSync(path)) {
    return runs;
  }
  const existing = (parse(readFileSync(path, "utf8")) as ResultsFile).runs;
  const merged = existing.map((old) => {
    const fresh = runs.find((r) => runKey(r) === runKey(old));
    if (!fresh) {
      return old;
    }
    const kept = old.scenarios.filter(
      (s) => !fresh.scenarios.some((f) => f.scenario === s.scenario),
    );
    return { ...fresh, scenarios: [...kept, ...fresh.scenarios] };
  });
  const added = runs.filter(
    (r) => !existing.some((o) => runKey(o) === runKey(r)),
  );
  return [...merged, ...added];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backend = args.backend?.[0] ?? "cli";
  const models = args.model?.length
    ? args.model
    : backend === "cli"
      ? ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929"]
      : ["anthropic/claude-haiku-4.5"];
  // A second, cheaper model for prompts that ask for the "flash" tier — the
  // mechanical ones. This is the knob that makes "what can we run small?"
  // measurable: score the same scenarios with and without it and read the
  // difference.
  const flashModel = args.flash?.[0];
  // minimal | low | medium | high, for models that take direction on it.
  const reasoning = args.reasoning?.[0];
  const only = args.scenario ?? [];
  const scenarios = only.length
    ? EVAL_SCENARIOS.filter((s) => only.includes(s.name))
    : EVAL_SCENARIOS;
  if (!scenarios.length) {
    throw new Error(`No scenarios matched ${only.join(", ")}`);
  }

  // Taken before anything expensive: it needs no network, and knowing which
  // prompts produced a number is worth nothing if it's recorded after the fact.
  const fingerprint = await promptFingerprint();
  console.log(`prompts ${fingerprint}`);

  // An unhandled rejection used to kill the process outright, discarding every
  // model not yet scored — a provider's bad minute costing an hour of runs. The
  // engine fires prompts it doesn't await (see lib/tracksettled.ts), so a
  // failure there escapes the try/catch around the scenario. Log and carry on:
  // the scenario it belonged to will fail on its own merits, which is the
  // honest outcome.
  process.on("unhandledRejection", (reason) => {
    console.warn(`  unhandled: ${String(reason).slice(0, 200)}`);
  });

  const runs: ModelRun[] = [];
  for (const model of models) {
    console.log(
      `\n=== ${model}${flashModel ? ` + ${flashModel} (flash)` : ""}` +
        `${reasoning ? ` [reasoning ${reasoning}]` : ""} (${backend}) ===`,
    );
    const results: ScenarioResult[] = [];
    for (const scenario of scenarios) {
      process.stdout.write(`  ${scenario.name}... `);
      let result: Awaited<ReturnType<typeof runScenario>>;
      try {
        result = await runScenario(
          scenario,
          backendFor(backend, model, flashModel, reasoning),
        );
      } catch (e) {
        // One scenario failing is one scenario's score, not the batch's.
        console.log(`ERROR ${String(e).slice(0, 200)}`);
        continue;
      }
      results.push({ ...result, promptFingerprint: fingerprint });
      const failed = result.checks.filter((c) => !c.passed).map((c) => c.name);
      console.log(
        `${result.passed}/${result.total} in ${Math.round(result.ms / 1000)}s` +
          (failed.length ? ` — failed: ${failed.join(", ")}` : "") +
          (result.error ? ` — ERROR ${result.error}` : ""),
      );
      for (const warning of result.dropped.slice(0, 3)) {
        console.log(`      dropped: ${warning.slice(0, 110)}`);
      }
      for (const warning of result.repaired.slice(0, 2)) {
        console.log(`      repaired: ${warning.slice(0, 110)}`);
      }
    }
    runs.push({
      model,
      backend,
      ...(flashModel ? { flashModel } : {}),
      ...(reasoning ? { reasoning } : {}),
      scenarios: results,
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(RESULTS_DIR, { recursive: true });
  const path = join(RESULTS_DIR, `${date}.yaml`);
  writeFileSync(
    path,
    stringify({ date, runs: merge(path, runs) }, { lineWidth: 0 }),
  );
  console.log(`\nwrote ${path}`);
  writeReports();
  console.log(`wrote ${SUMMARY} and ${PAGE}`);
}

await main();
