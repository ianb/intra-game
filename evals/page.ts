import type { ScenarioResult } from "./harness";

/**
 * Render the recorded results as a single self-contained HTML page.
 *
 * Self-contained on purpose: no build step, no scripts, no fetches. The file
 * that gets committed is the file that gets served, so it works opened from
 * disk, published by GitHub Pages, or copied into the deployed site — and it
 * still works in five years when whatever would have fetched the data is gone.
 */

export interface ModelRun {
  model: string;
  backend: string;
  /** Set when the run used a second, cheaper model for the "flash" tier. */
  flashModel?: string;
  /** Set when the run asked for a specific reasoning effort. */
  reasoning?: string;
  scenarios: ScenarioResult[];
}

/** Distinct prompt fingerprints in a day's results; see evals/report.ts. */
function fingerprintsOf(data: ResultsFile): string[] {
  return [
    ...new Set(
      data.runs.flatMap((run) =>
        run.scenarios.flatMap((s) =>
          s.promptFingerprint ? [s.promptFingerprint] : [],
        ),
      ),
    ),
  ];
}

export interface ResultsFile {
  date: string;
  runs: ModelRun[];
}

const escapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => escapeMap[c]!);
}

/**
 * Two voices share these pages, and the joke is the contrast between them.
 * Both the eval page and the playthrough pages (evals/playthroughs.ts) use
 * these helpers, so the rules live here, next to the code that renders them.
 *
 * THE ARCHIVIST — the enthusiastic frame. It is the same terminal that greets
 * the player in the game, and it introduces and signs off each page. Wrap its
 * lines in `archivist()`; announce sections with `archiveBanner()`; divide
 * with `shadeRule()`. Keep it:
 *
 *  - Delighted. It LOVES records and being asked for them: exclamation points,
 *    an ALL-CAPS word here and there for one it is fond of.
 *  - Self-important but harmless. It keeps everything and remembers everything,
 *    and is certain this is the best job in the complex.
 *  - Decorated. Extended-ASCII shading (░▒▓█) and box-drawing (╔═╗) around its
 *    announcements, arrows (►◄) for asides. Extended ASCII only, never emoji:
 *    the blocky glyphs are what set the terminal voice off from the prose.
 *  - Brief. It decorates and enthuses; it does not explain the machinery. It
 *    says its piece and hands back to the operators.
 *
 * THE OPERATORS — the flat exposition between the Archivist's lines (the
 * <p> body text, the APPARATUS block, the summary captions). This is the
 * straight man, and it stays deadpan. Write it to ASD-STE100 (ASD Simplified
 * Technical English, the aerospace controlled-English spec): short sentences,
 * one idea per sentence, the same word for the same thing every time, active
 * voice, no idiom and no flourish. Two reasons, not one: it reads like the
 * facility's own maintenance documentation, and holding the exposition flat is
 * what makes the Archivist's decoration funny by comparison. Do not let the
 * two voices bleed. No exclamation points and no box-drawing in operator text;
 * no measurements or defined terms inside an `archivist()` line.
 */

/** A boxed, shaded title banner in the Archive's terminal style. */
export function archiveBanner(title: string, subtitle: string): string {
  const body = [`░▒▓█ ${title} █▓▒░`, subtitle];
  const inner = Math.max(...body.map((line) => line.length)) + 2;
  const bar = "═".repeat(inner);
  const rows = body.map((line) => `║ ${line.padEnd(inner - 2)} ║`).join("\n");
  return `<pre class="artbanner">${esc(`╔${bar}╗\n${rows}\n╚${bar}╝`)}</pre>`;
}

/** A full-width decorative rule of shade blocks; clips at the page edge. */
export function shadeRule(): string {
  return `<div class="shaderule" aria-hidden="true">${"░▒▓█".repeat(48)}</div>`;
}

/** One announcement in the Archivist's voice. Pass trusted HTML. */
export function archivist(html: string): string {
  return `<p class="archivist">${html}</p>`;
}

/**
 * Suite costs in cents, always: "1.5\u00a2", "245.0\u00a2". One unit and one
 * decimal place so the column lines up for comparison, which is the only
 * reason the number is on the page.
 */
function cents(cost: number): string {
  return `${(cost * 100).toFixed(1)}\u00a2`;
}

function scoreClass(passed: number, total: number): string {
  if (total === 0) return "none";
  if (passed === total) return "pass";
  return passed === 0 ? "fail" : "partial";
}

function scenarioCell(result: ScenarioResult | undefined): string {
  if (!result) {
    return `<td class="score none">–</td>`;
  }
  const failed = result.checks.filter((c) => !c.passed).map((c) => c.name);
  const title = failed.length
    ? `failed: ${failed.join(", ")}`
    : "all checks passed";
  return `<td class="score ${scoreClass(result.passed, result.total)}" title="${esc(title)}">${result.passed}/${result.total}</td>`;
}

function transcriptBlock(run: ModelRun, result: ScenarioResult): string {
  if (!result.transcript.length) {
    return "";
  }
  const lines = result.transcript
    .map((line) => {
      const at = line.indexOf(": ");
      const who = at === -1 ? "" : line.slice(0, at);
      const text = at === -1 ? line : line.slice(at + 2);
      return `<p><span class="who">${esc(who)}</span>${esc(text)}</p>`;
    })
    .join("\n");
  return `
<details>
  <summary>${esc(run.model)} — ${esc(result.scenario)} <span class="meta">${result.passed}/${result.total}, ${Math.round(result.ms / 1000)}s</span></summary>
  <div class="transcript">${lines}</div>
</details>`;
}

function runSection(data: ResultsFile, scenarioNames: string[]): string {
  const header = scenarioNames.map((name) => `<th>${esc(name)}</th>`).join("");
  const rows = data.runs
    .map((run) => {
      const cells = scenarioNames
        .map((name) =>
          scenarioCell(run.scenarios.find((s) => s.scenario === name)),
        )
        .join("");
      const passed = run.scenarios.reduce((a, s) => a + s.passed, 0);
      const total = run.scenarios.reduce((a, s) => a + s.total, 0);
      const seconds = Math.round(
        run.scenarios.reduce((a, s) => a + s.ms, 0) / 1000,
      );
      // Provider-reported cost for the whole suite. Zero means the backend
      // did not report billing (the Claude CLI does not), and rendering that
      // as 0.0¢ would claim the run was free — unreported shows a dash
      // instead.
      const cost = run.scenarios.reduce((a, s) => a + (s.usage?.cost ?? 0), 0);
      const costCell =
        cost > 0
          ? `<td class="cost">${cents(cost)}</td>`
          : `<td class="cost none">–</td>`;
      return `<tr>
        <th class="model">${esc(run.model)}<span class="meta">${run.flashModel ? `+ ${esc(run.flashModel)} (flash) · ` : ""}${esc(run.backend)} · ${seconds}s</span></th>
        ${cells}
        <td class="score total ${scoreClass(passed, total)}">${passed}/${total}</td>
        ${costCell}
      </tr>`;
    })
    .join("\n");

  const failures = data.runs.flatMap((run) =>
    run.scenarios.flatMap((s) =>
      s.checks
        .filter((c) => !c.passed)
        .map(
          (c) =>
            `<li><code>${esc(run.model)}</code> <b>${esc(s.scenario)}/${esc(c.name)}</b> — ${esc(c.describe)}</li>`,
        ),
    ),
  );

  const transcripts = data.runs
    .flatMap((run) => run.scenarios.map((s) => transcriptBlock(run, s)))
    .join("\n");

  const fingerprints = fingerprintsOf(data);
  const provenance = !fingerprints.length
    ? "recorded before prompt fingerprints"
    : fingerprints.length === 1
      ? `prompts ${esc(fingerprints[0]!)}`
      : `prompts ${fingerprints.map(esc).join(", ")} — not directly comparable`;

  return `
<section>
  <h2>${esc(data.date)} <span class="meta">${provenance}</span></h2>
  <div class="scroller">
    <table>
      <thead><tr><th></th>${header}<th>total</th><th>cost</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${
    failures.length
      ? `<h3>What failed</h3><ul class="failures">${failures.join("")}</ul>`
      : `<p class="allclear">Every check passed for every model in this run.</p>`
  }
  <details class="transcripts">
    <summary>Transcripts</summary>
    <p class="note">What the characters said in each run, so a failed text
    check can be compared with the text it judged.</p>
    ${transcripts}
  </details>
</section>`;
}

export function renderPage(
  files: ResultsFile[],
  scenarioNames: string[],
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intra — model evals</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  ${archiveBanner("INTRA ARCHIVE", "CAPABILITY RECORDS · filed with love")}
  ${archivist(
    `Oh, a CAPABILITY inquiry! ►► You want to know which minds can run the ` +
      `complex ◄◄ I have kept every test. Every one! Below: can a given model ` +
      `wear the whole facility at once and not drop a tag. I find this ` +
      `THRILLING. The operators, as ever, do not. They wrote the rest.`,
  )}
  <h1>Can a model run this game?</h1>
  <p>Intra asks a model to stay in character while emitting tags the engine acts
  on. These runs score whether the engine could act on everything the model said,
  and whether the game reached the state each scenario aimed at. Nothing here
  scores whether the writing was any good.</p>
  <p class="note">Generated from the YAML under <code>evals/results/</code> by
  <code>pnpm evals</code>. Scenarios and checks are in <code>evals/scenarios.ts</code>.</p>
  <p class="note">These are short, separate scenarios. To see a model play
  the game for many turns, with its notes visible, see the
  <a href="/playthroughs/">recorded playthroughs</a>.</p>
  <p class="note">The cost column is the provider's own charge for the whole
  suite, in cents, so it compares runs on the same backend and not across
  backends. A dash means the backend does not report billing.</p>
</header>
${files.map((data) => runSection(data, scenarioNames)).join("\n")}
${shadeRule()}
${archivist(
  `That is the whole shelf! ►► Come back when there are newer minds to test ◄◄ ` +
    `I will have kept everything. I always do. It is the BEST job in the complex.`,
)}
<footer>
  <p>The tiers scored so far land within a check of each other, so these
  scenarios establish a floor rather than a ceiling. They mark where a model
  fails this game, not which model plays it best. Each run is one sample, so a
  one-check difference is noise. A whole scenario is signal.</p>
</footer>
</body>
</html>
`;
}

// The game's own look, deliberately: dark only, like the game, with the
// cyan links and gray panels of the play UI. These pages are records the
// Archive produced, and they should read that way.
export const STYLE = `
:root {
  color-scheme: dark;
  --bg: #111827; --fg: #e5e7eb; --dim: #9ca3af; --line: #374151;
  --pass: #4ade80; --partial: #facc15; --fail: #f87171; --panel: #1f2937;
}
a { color: #67e8f9; }
.artbanner { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
             color: #facc15; font-size: .8rem; line-height: 1.05;
             letter-spacing: 0; white-space: pre; overflow-x: auto;
             margin: 0 0 1rem; }
.shaderule { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
             color: var(--line); white-space: nowrap; overflow: hidden;
             opacity: .7; margin: 2rem 0 1.25rem; user-select: none; }
.archivist { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
             color: #facc15; background: var(--panel);
             border: 1px solid var(--line); border-left: 3px solid #facc15;
             border-radius: 6px; padding: .75rem 1rem; font-size: .85rem; }
.archivist b { color: #fde68a; }
* { box-sizing: border-box; }
body {
  margin: 0 auto; padding: 2.5rem 1.25rem 4rem; max-width: 60rem;
  background: var(--bg); color: var(--fg);
  font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
h1 { font-size: 1.6rem; margin: 0 0 .75rem; letter-spacing: -.01em; }
h2 { font-size: 1.15rem; margin: 2.5rem 0 .75rem; font-variant-numeric: tabular-nums; }
h3 { font-size: .95rem; margin: 1.75rem 0 .5rem; color: var(--dim); font-weight: 600;
     text-transform: uppercase; letter-spacing: .06em; }
header p { max-width: 46rem; }
.note, .meta { color: var(--dim); font-size: .85rem; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
.scroller { overflow-x: auto; margin: .5rem 0 1rem; }
table { width: 100%; border-collapse: collapse; min-width: 30rem; }
th, td { padding: .5rem .6rem; border-bottom: 1px solid var(--line); text-align: left; }
thead th { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em;
           color: var(--dim); font-weight: 600; }
th.model { font-weight: 600; font-family: ui-monospace, monospace; font-size: .85rem; }
th.model .meta { display: block; font-weight: 400; font-family: inherit; }
td.score { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
td.score.pass { color: var(--pass); }
td.score.partial { color: var(--partial); }
td.score.fail { color: var(--fail); }
td.score.none { color: var(--dim); font-weight: 400; }
td.total { border-left: 1px solid var(--line); }
td.cost { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap;
          color: var(--dim); }
td.cost.none { text-align: center; }
ul.failures { margin: 0; padding-left: 1.1rem; }
ul.failures li { margin: .3rem 0; }
.allclear { color: var(--dim); }
details { border: 1px solid var(--line); border-radius: 6px; margin: .4rem 0;
          background: var(--panel); }
summary { cursor: pointer; padding: .55rem .75rem; font-size: .9rem;
          font-family: ui-monospace, monospace; }
summary .meta { font-family: inherit; }
.transcript { padding: .25rem 1rem 1rem; border-top: 1px solid var(--line); }
.transcript p { margin: .55rem 0; }
details.transcripts { border: none; background: none; margin-top: 1.5rem; }
details.transcripts > summary { padding: 0; font-size: .95rem; font-weight: 600;
  font-family: inherit; color: var(--dim); text-transform: uppercase;
  letter-spacing: .06em; }
details.transcripts > .note, details.transcripts > details { margin-left: .25rem; }
.who { display: inline-block; min-width: 5.5rem; color: var(--dim);
       font-family: ui-monospace, monospace; font-size: .8rem; }
footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--line);
         color: var(--dim); font-size: .9rem; }
@media (max-width: 34rem) {
  .who { display: block; min-width: 0; }
  body { padding-top: 1.5rem; }
  th.model { word-break: normal; }
  summary { font-size: .8rem; }
}
`;
