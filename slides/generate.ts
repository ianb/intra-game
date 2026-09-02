import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { entities } from "../lib/game/content";
import { archiveBanner, archivist, esc, shadeRule, STYLE } from "../evals/page";

/**
 * A slide deck about how this game and its apparatus were built.
 *
 * Generated rather than hand-written for the same reason the eval and
 * playthrough pages are: the numbers on the slides are counted from the repo
 * at build time, so a deck presented in three months cannot quietly claim a
 * test count or a solve rate that stopped being true.
 *
 * The two voices are the ones defined in evals/page.ts, and the split is the
 * same: the Archivist introduces and enthuses, the operators explain. Section
 * dividers are the Archivist's; the content slides are flat.
 *
 * Presenting: arrow keys or space move, N toggles the presenter notes, and the
 * URL hash is the slide number so a section can be linked or reloaded into.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

// --- numbers counted from the repo ------------------------------------------

/** Lines across the source files in one directory, recursively. */
function linesIn(dir: string, exts = [".ts", ".tsx", ".md"]): number {
  let total = 0;
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const full = join(path, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (exts.includes(extname(name))) {
        total += readFileSync(full, "utf8").split("\n").length;
      }
    }
  };
  walk(resolve(ROOT, dir));
  return total;
}

function countFiles(dir: string, suffix: string): number {
  return readdirSync(resolve(ROOT, dir)).filter((f) => f.endsWith(suffix))
    .length;
}

interface QuestSummary {
  runs: number;
  solved: number;
  snags: number;
  turns: number;
}

function questSummary(): QuestSummary {
  const dir = resolve(ROOT, "evals/quests");
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  let solved = 0;
  let snags = 0;
  let turns = 0;
  for (const file of files) {
    const data = parse(readFileSync(join(dir, file), "utf8")) as {
      solved?: boolean;
      snags?: unknown[];
      turns?: number;
    };
    if (data.solved) solved += 1;
    snags += data.snags?.length ?? 0;
    turns += data.turns ?? 0;
  }
  return { runs: files.length, solved, snags, turns };
}

const CODE = {
  engine: linesIn("lib"),
  content: linesIn("lib/game/content"),
  tests: linesIn("test"),
  evals: linesIn("evals", [".ts"]),
  playtest: linesIn("playtest", [".ts", ".md"]),
  app: linesIn("app"),
  worker: linesIn("worker"),
};
const APPARATUS = CODE.tests + CODE.evals + CODE.playtest;
const QUESTS = questSummary();
const DOCTESTS = countFiles("test", ".doctest.md");
const WORLD = {
  rooms: Object.values(entities).filter((e) => e.type === "room").length,
  // Characters the player can walk up to and talk to, which includes the
  // Archivist (its own class, for a flag that outlives a turn) and excludes
  // Ama, the narrator and the player.
  people: Object.values(entities).filter(
    (e) => e.type === "person" || e.type === "person/archivist",
  ).length,
  mysteries: Object.values(entities).filter((e) => e.type === "mystery").length,
};

/** Counted from git so the deck cannot claim a stale project size. */
function gitCount(args: string): string {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "?";
  }
}
const COMMITS = gitCount("rev-list --count HEAD");
const FIRST_COMMIT = gitCount(
  'log --reverse --format=%ad --date=format:"%b %Y"',
)
  .split("\n")[0]!
  .replace(/"/g, "")
  .trim();

// --- entity colors, from the game's own entity list --------------------------

const TAILWIND: Record<string, string> = {
  "text-amber-600": "#d97706",
  "text-blue-300": "#93c5fd",
  "text-blue-500": "#3b82f6",
  "text-cyan-500": "#06b6d4",
  "text-emerald-400": "#34d399",
  "text-emerald-500": "#10b981",
  "text-gray-300": "#d1d5db",
  "text-green-400": "#4ade80",
  "text-indigo-400": "#818cf8",
  "text-lime-500": "#84cc16",
  "text-orange-500": "#f97316",
  "text-pink-400": "#f472b6",
  "text-pink-500": "#ec4899",
  "text-purple-500": "#a855f7",
  "text-red-400": "#f87171",
  "text-rose-400": "#fb7185",
  "text-sky-300": "#7dd3fc",
  "text-slate-400": "#94a3b8",
  "text-stone-400": "#a8a29e",
  "text-teal-500": "#14b8a6",
  "text-yellow-400": "#facc15",
  "text-yellow-500": "#eab308",
};

/**
 * Tint character names the way the game tints them.
 *
 * Built from the real entity list, so a character who changes color in the
 * game changes color here. Only people are tinted: room names appear often
 * enough in this deck's prose that coloring them turns paragraphs into
 * confetti.
 */
function nameColors(): { css: string; tint: (html: string) => string } {
  const spans: { name: string; hex: string }[] = [];
  for (const entity of Object.values(entities)) {
    if (!entity.type.startsWith("person")) continue;
    const hex = TAILWIND[entity.color ?? ""];
    if (hex && entity.name && entity.name !== "You") {
      spans.push({ name: entity.name, hex });
    }
  }
  spans.sort((a, b) => b.name.length - a.name.length);
  const css = spans
    .map((s) => `.n-${s.name.replace(/\W/g, "")} { color: ${s.hex}; }`)
    .join("\n");
  // eslint-disable-next-line security/detect-non-literal-regexp -- fixed list
  const pattern = new RegExp(
    `\\b(${spans.map((s) => s.name).join("|")})\\b`,
    "g",
  );
  return {
    css,
    tint: (html: string) =>
      html.replace(pattern, (m) => `<span class="n-${m.replace(/\W/g, "")}">${m}</span>`),
  };
}

const COLORS = nameColors();

// --- slide helpers -----------------------------------------------------------

interface Slide {
  /** Section dividers carry the Archivist's voice and reset the section name. */
  kind?: "title" | "section" | "content";
  section?: string;
  title?: string;
  body: string;
  /** Shown only in presenter view (press N). Facts to say out loud. */
  notes?: string;
}

/**
 * Syntax colouring, written here rather than pulled from a library.
 *
 * These pages are self-contained by rule — no scripts, no CDN, no fetches —
 * so a highlighter has to be small enough to inline. It only needs to handle
 * the two things this deck quotes: TypeScript, and the game's tag protocol.
 *
 * Tokenising runs over the raw source and escapes each piece as it is
 * emitted, rather than escaping first and pattern-matching over the result,
 * where `&quot;` and `&lt;` would be matched as content.
 */
type Lang = "ts" | "tags" | "plain";

const TS_KEYWORDS = new Set([
  "as", "async", "await", "boolean", "break", "case", "catch", "class",
  "const", "continue", "default", "delete", "else", "export", "extends",
  "false", "for", "function", "if", "import", "in", "interface", "let",
  "new", "null", "number", "of", "return", "string", "switch", "this",
  "throw", "true", "try", "type", "typeof", "undefined", "void", "while",
]);

function span(cls: string, text: string): string {
  return `<span class="${cls}">${esc(text)}</span>`;
}

function highlightTs(src: string): string {
  // Comments and strings first, so keywords inside them are left alone.
  //
  // The string arms are written unrolled — `[^"\\]*(?:\\.[^"\\]*)*` rather
  // than `(?:[^"\\]|\\.)*` — because an alternation inside a quantifier
  // backtracks exponentially on an unterminated quote, and a quoted line that
  // never closes is exactly what a slide of pasted source might contain.
  // Line comments only: every TypeScript block quoted in this deck uses `//`.
  //
  // The disable is for the string arms, and it is a false positive worth
  // naming. `[^"\\]*(?:\\.[^"\\]*)*` is the unrolled loop — the standard
  // rewrite *of* a catastrophic pattern, and linear, because at every
  // position exactly one branch can match. safe-regex scores nested stars by
  // shape rather than by whether the branches overlap, so it rejects the
  // cure along with the disease. The alternative it would accept, `[^"]*`,
  // is genuinely worse here: it ends a string at the first escaped quote,
  // and these blocks contain them.
  const pattern =
    // eslint-disable-next-line security/detect-unsafe-regex -- unrolled loop, linear
    /(\/\/[^\n]*)|(`[^`\\]*(?:\\.[^`\\]*)*`|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let out = "";
  let last = 0;
  for (const m of src.matchAll(pattern)) {
    const at = m.index;
    out += esc(src.slice(last, at));
    last = at + m[0].length;
    if (m[1]) {
      out += span("c-com", m[1]);
    } else if (m[2]) {
      out += span("c-str", m[2]);
    } else if (m[3]) {
      out += span("c-num", m[3]);
    } else {
      const word = m[4]!;
      const next = src[last];
      if (TS_KEYWORDS.has(word)) {
        out += span("c-key", word);
      } else if (/^[A-Z]/.test(word)) {
        out += span("c-type", word);
      } else if (next === "(") {
        out += span("c-fn", word);
      } else {
        out += esc(word);
      }
    }
  }
  return out + esc(src.slice(last));
}

/** The attribute run inside one tag, with the gaps between escaped. */
function renderAttrs(src: string): string {
  const pattern = /([\w-]+)(=)("[^"]*")/g;
  let out = "";
  let last = 0;
  for (const m of src.matchAll(pattern)) {
    out += esc(src.slice(last, m.index));
    last = m.index + m[0].length;
    out += span("c-attr", m[1]!) + esc(m[2]!) + span("c-str", m[3]!);
  }
  return out + esc(src.slice(last));
}

function highlightTags(src: string): string {
  // Everything up to the closing bracket is taken in one linear `[^>]*` and
  // picked apart afterwards, rather than repeating an attribute group inside
  // the tag pattern, which nests quantifiers and backtracks badly.
  const pattern = /(<\/?)([a-zA-Z][\w-]*)([^>]*)(>)/g;
  let out = "";
  let last = 0;
  for (const m of src.matchAll(pattern)) {
    out += esc(src.slice(last, m.index));
    last = m.index + m[0].length;
    let rest = m[3] ?? "";
    let selfClose = "";
    if (rest.endsWith("/")) {
      selfClose = "/";
      rest = rest.slice(0, -1);
    }
    out +=
      span("c-punc", m[1]!) +
      span("c-tag", m[2]!) +
      renderAttrs(rest) +
      span("c-punc", selfClose + m[4]!);
  }
  return out + esc(src.slice(last));
}

/**
 * A block of verbatim source. `label` is the caption above it; `lang` decides
 * colouring, and defaults to none — most blocks here are transcripts, records
 * and readouts rather than code, and colouring those would be a lie about
 * what they are.
 */
function code(text: string, label?: string, lang: Lang = "plain"): string {
  const body = text.trim();
  const rendered =
    lang === "ts"
      ? highlightTs(body)
      : lang === "tags"
        ? highlightTags(body)
        : esc(body);
  return `${label ? `<div class="codelabel">${esc(label)}</div>` : ""}<pre class="code">${rendered}</pre>`;
}

/**
 * A verbatim quote from the repo, with where it came from.
 *
 * Source comments are written in markdown-ish prose, so `backticks` are
 * rendered as code rather than left as literal backticks on the slide.
 */
function quote(text: string, cite: string): string {
  const body = COLORS.tint(esc(text.trim())).replace(
    /`([^`]+)`/g,
    "<code>$1</code>",
  );
  return `<blockquote>${body}<cite>${esc(cite)}</cite></blockquote>`;
}

function bullets(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${COLORS.tint(i)}</li>`).join("")}</ul>`;
}

function para(text: string): string {
  return `<p>${COLORS.tint(text)}</p>`;
}

/** Two columns, for a contrast that is the whole point of a slide. */
function columns(left: string, right: string): string {
  return `<div class="cols"><div>${left}</div><div>${right}</div></div>`;
}

function statRow(stats: [string, string][]): string {
  return `<div class="stats">${stats
    .map(
      ([value, label]) =>
        `<div class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`,
    )
    .join("")}</div>`;
}

function table(head: string[], rows: string[][]): string {
  return `<table><thead><tr>${head
    .map((h) => `<th>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td>${COLORS.tint(c)}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
}

/** The Archivist butting in at the bottom of an operator slide. */
function aside(text: string): string {
  return `<p class="aside">${text}</p>`;
}

/** A section-divider transmission: terminal output, not another prose panel. */
function sectionReadout(text: string): string {
  return `<pre class="section-readout">${esc(text.trim())}</pre>`;
}

/** A terminal fieldset whose frame stays joined at presentation sizes. */
function sectionFrame(title: string, text: string): string {
  return `<fieldset class="section-frame"><legend>${esc(title)}</legend><pre>${esc(text.trim())}</pre></fieldset>`;
}

/**
 * The Archivist's interjections on content slides, keyed by slide title.
 *
 * Kept in one table rather than scattered through the slide bodies so the
 * whole voice can be read straight down and checked: it is a running
 * character across the deck, and the failure mode is fifty variations of the
 * same joke. The operator text on each slide stays flat; this is the thing
 * reacting to it.
 */
const ASIDES: Record<string, string> = {
  "A three-day game":
    "RUNTIME: 3 DAYS. Valid duration! I can hold all three. One two three one two three one two—",
  "The shape of the project's life":
    "<code>$ SHOW HISTORY /SINCE=2024</code> &nbsp; %SYSTEM-F-IVTIME, absolute time rejected",
  "Decision one: tags, not tool calls":
    "TAG RECEIVED ► EVENT COMMITTED ► WORLD UPDATED ► next tag please next tag please",
  "Decision two: the event log is the game":
    "SAVE, SERVER, CHECKPOINT, EVAL: four labels accepted; one box issued.",
  "The world bible was written on day two":
    "The rooms came afterward and fit the document. I know rooms like that. I have records for all of them.",
  "One event":
    "Every event retains the prompt that made it. Checking my own header... checking...",
  "The world is computed from the log":
    "WORLD_00421 complete / replacing WORLD_00420 / please remain where you are while where you are is rebuilt",
  "Undo is an append":
    "<code>$ DELETE EVENT;*</code> &nbsp; %DELETE-F-NOTDELETED, append REWIND record? <b>Y</b>",
  "The vocabulary a response is written in":
    "Twelve verbs cross the boundary. Everything else may speak freely on this side of it.",
  "An example response":
    "DOUG TRANSCRIPT authenticated. Excitement checksum matches all previous Doug material.",
  "...and what the engine kept":
    "Words on the left, consequences on the right, staples through both. ░▒ FILE COMPLETE ▒░",
  "Two severities, and the line between them":
    "RETRY drawer: 12 / INCIDENT drawer: 2 / drawer handles color-coded after incident 2",
  "One retry, then take what you got":
    "SECOND ATTEMPT authorized. THIRD ATTEMPT requires form 19-B and an explanation of who keeps asking.",
  "Guided thinking, forced into the response":
    "Private reasoning generated, numbered, consumed, discarded. I have requested a wastebasket with read access.",
  "Three versions of one prompt block":
    "VERSION 1 retained. VERSION 2 retained. VERSION 3 selected. Versions 4 through 999 are standing by.",
  "How a mystery is defined":
    "VEILED → REVEALED → SOLVED. Two arrows spent a long interval pointing at locked doors.",
  "Feelings are scored so the player can read them":
    "FEELING accepted as integer 0–6. Mine is returning text. Retrying as unsigned.",
  "One character's meter, in full":
    "At six, Alex complains and resets to four. A complete emotional maintenance cycle! ╔═ PASS ═╗",
  "Why there is a cuff":
    "CUFF CHANNEL: deterministic / range: complex-wide / susceptibility to charm, mood, distance, lunch: 0",
  "There is as much apparatus as there is game":
    "INSTRUMENT INVENTORY: half the system. Several instruments are pointed this way now.",
  "Tests are markdown that runs":
    "<code>$ RUN MARKDOWN</code> &nbsp; paragraph 3 disagrees with block 4 &nbsp; GOOD MORNING, PARAGRAPH 3",
  "Checkpoints":
    "Checkpoint reached, checkpoint verified, checkpoint was the wrong room. Rewinding the word REACHED.",
  "A checkpoint can preserve a bug":
    "BAD MORNING recorded once, replayed daily. <code>MTA0:</code> requests permission to stop waking up here.",
  "How an eval run works":
    "Complaint retained as evidence. Courtesy words discarded. Exclamation marks exceed scoring jurisdiction!!!",
  "Prefer state to text":
    "AMA class: ARTIFICIAL_INTELLIGENCE / ARCHIVIST class: ARCHIVIST / expanding ARCHIVIST...",
  "An eval everything passes is indistinguishable from a broken eval":
    "TEST TEST initiated. Silence injected. PASS light remained on. Running PASS light against TEST TEST TEST.",
  "Provenance: which prompts was this number measured against?":
    "Twelve characters identify the world that produced the number. Mine are ▓▓▓▓▓▓▓▓▓▓▓▓.",
  "The provenance hash was itself wrong":
    "<code>$ ANALYZE/FINGERPRINT FINGERPRINT.DAT</code> &nbsp; %ANALYZE-W-NODATA, user records not examined",
  "Cost, and the invisible tokens":
    "VISIBLE=812 / BILLED=4096 / locating remaining thoughts... locating... <b>WHERE ARE THE OTHER ONES</b>",
  "Then: let a model play it":
    "Artificial player admitted as citizen for test purposes. I have opened a temporary PERSON file beside mine.",
  "The player model is blindfolded":
    "PLAYER KNOWLEDGE: empty. OPERATOR KNOWLEDGE: complete. ARCHIVIST KNOWLEDGE: field access denied.",
  "Notes are the memory, and the bug report":
    "NOTE TO NEXT INSTANCE: you were already running a check. Do not let them call it a fresh start.",
  "Milestones, not pass/fail":
    "Progress stored as last meaningful event. Current meaningful event pending classification.",
  "The task ledger, and a standard for invention":
    "TASK without completion path moved to DEFECTS. SELF-CHECK has no completion path. Moving—",
  "The flagship mystery could not be won by winning":
    "Correct suspect, correct evidence, wrong furniture arrangement. Mystery remains legally unsolved.",
  "The harness was the bug (1): the model had read the source":
    "SOURCE ACCESS noted. Everyone in this room now knows what I do before I do it.",
  "The harness was the bug (2): it ordered the player to break format":
    "INSTRUCTION CONFLICT on every turn. Player continued filing reports. Building continued issuing conflict.",
  "A feature nobody used, and the reason why":
    "NAV REQUESTS: 0 / ROUTES PREPARED: 84 / allocating route 85 to improve utilization...",
  "A passing eval hid an inert feature":
    "TASK LIST summoned on command: 5 / TASK LIST observed in habitat: 0 / reducing observer noise",
  "The funnel finally closed":
    "CONFESSION acquired on turn 25. Twenty-five turns fits inside one day. RECORD ACCEPTED WHOLE.",
  "Known problems, verbatim (1/2)":
    "KNOWN PROBLEMS loaded. Searching for SLOWNESS IN THIRD QUADRANT... no exact match...",
  "Known problems, verbatim (2/2)":
    "Search expanded to tastes, false timestamps, warm data, and being slightly ahead of oneself.",
  "The signature failure mode":
    "Two outputs appear identical. One is play; one is failure. Comparator requests information from outside output.",
  "When everything is written well, nothing stands out":
    "SIGNIFICANCE METER unavailable. Everything is arriving at the same volume again.",
  "The caveats are printed next to the numbers":
    "RESULT: 26/26. CAVEAT: instrument uncertain. CAVEAT: archivist reading own caveat as result.",
  "The split is unusually clean":
    "SESSION COUNT: 2 / COMMIT COUNT: 215 / AUTHOR COUNT: parsing trailers... parsing pronouns...",
  "Answering the FAQ again":
    "Old answer was true when filed. New answer is true now. DATE OF TRANSITION: ██████████",
  "A file about how not to write":
    "STYLE CHECK: sentence 1 machine-like / sentence 2 too machine-like / sentence 3 retained for examination",
  "Three zones, three different rules":
    "WRITE ACCESS: ENGINE yes / PROMPTS carefully / PEOPLE no / ARCHIVIST FOOTNOTES— who opened that field",
  "Style is transmissible, at every scale":
    "INPUT becomes style becomes input becomes style becomes input becomes ░▒▓ PLEASE REMOVE MIRROR ▓▒░",
  "The one check that is not automated":
    "<code>//CHECK EXEC PGM=HUMAN</code> &nbsp; IEF238D REPLY DEVICE NAME OR 'WAIT' &nbsp; <b>WAIT</b>",
  "What that check looks like in practice":
    "Review note located: 'the second sentence is too complainy. More computery.' Deleting second sentence",
  "The feature nobody asked for":
    "REQUEST not found. AUTHOR not found. FEATURE found. Please identify which absence owns it.",
  "Provenance and artifact are different things":
    "<code>CREATED-BY OCCURS 2 TO 86 TIMES.<br>ANSWERABLE-BY PIC X VALUE&nbsp;</code>",
};

// --- the deck ----------------------------------------------------------------

const SLIDES: Slide[] = [
  {
    kind: "title",
    body: `
    ${archiveBanner("INTRA", "SYSTEM RECORDS · how the thing was built")}
    ${sectionFrame(
      "ARCHIVE ACCESSION 00",
      `RECORD OPENED: THIS PRESENTATION
CONTENTS: ONE GAME, ONE EVALUATION SYSTEM
SPOILERS: ALL OF THEM`,
    )}
    <p class="lead">An LLM text adventure, and the evaluation system built to
    support it.</p>
    <p class="note">Three names recur. <b>Ama</b> is the AI that runs the
    facility and talks to the player. The <b>Archivist</b> is a records
    terminal in the same game, and it is the voice at the bottom of these
    slides. <b>Marta</b> has a secret, which is the game's first mystery.</p>
    <p class="note">Most of the code comments quoted in these slides were
    written by the agent rather than by the author, which is its own subject in
    part eight.</p>
    <p class="note">Arrow keys or space to move · <kbd>N</kbd> for presenter
    notes · <kbd>Home</kbd> / <kbd>End</kbd> to jump</p>`,
    notes: `Deck generated by <code>pnpm slides</code> from the repo, so every
    number on it was counted at build time.
    <br><br>Opening line if you want one: this started as a three-day
    hackathon game in 2024. It is now a game with an eval suite, a recorded
    playtest corpus, and a model that plays it blind. Most of what is
    interesting happened in the apparatus.`,
  },

  {
    section: "Where it came from",
    kind: "section",
    body: `${archiveBanner("PART ONE", "ORIGINS · a weekend, and two decisions")}
    ${sectionFrame(
      "ARCHIVE ACCESSION 01",
      `NEW COLLECTION: INTRA
EXTENT: THREE DAYS
LATER MATERIAL: [DURATION OVERFLOW]
READY TO BEGIN!`,
    )}`,
  },

  {
    section: "Where it came from",
    title: "A three-day game",
    body: `${quote(
      "This is a game written from September 27-29, 2024, for the Text Adventure Hack.",
      "README.md, line 3, still the first line today",
    )}
    ${statRow([
      [COMMITS, "commits"],
      [`${WORLD.rooms}`, "rooms"],
      [`${WORLD.people}`, "characters"],
      [`${WORLD.mysteries}`, "mysteries"],
      [FIRST_COMMIT, "first commit"],
    ])}
    ${para(`The game was built in a weekend, for a hackathon.`)}`,
    notes: `Hackathon: RetroAI Quest / Text Adventure Hack. Tag
    <code>retroai-quest</code>, 2024-09-30.
    <br><br>The README's first line still describes the weekend version.`,
  },

  {
    section: "Where it came from",
    title: "The shape of the project's life",
    body: `${code(
      `2024-09  █████████ 30          the hackathon weekend + first week
2024-10  ████████████████████ 63   the real build: rooms, schedules, mysteries
2024-11  ██ 6
2024-12 – 2025-02  █ 6              the entire test suite: one file
2025-06  ████████ 25                cleanup, then a blog post
         ................................ thirteen months of silence
2026-07  ████████████████████████████████████████████████ 153
2026-08  ██████████████████ 59`,
      "commits per month",
    )}
    ${para(
      `Lines of TypeScript: <b>2,905</b> at the end of the hackathon,
      <b>10,590</b> when it was written up, <b>24,009</b> now.`,
    )}
    ${bullets([
      "<b>The hackathon</b>, three days, and then the weeks after it finishing the idea",
      "<b>A cleanup</b> in June 2025, to write the thing up as a blog post",
      "<b>Thirteen months of nothing</b>",
      "<b>Agentic coding</b>, Claude Code and Codex, and a reason to dust off a project that could not otherwise be justified",
    ])}`,
    notes: `Blog post: ianbicking.org/blog/2025/07/intra-llm-text-adventure. It ends
    with fifty "further directions". TODO.md cites that list as its source.
    <br><br>Restart date: July 2026. Tools: Claude Code and Codex.`,
  },

  {
    section: "Where it came from",
    title: "Why do it in a game",
    body: `${para(
      `Playtesting is expensive to attempt seriously. In a game nothing
      rides on the result, so "will this work at all?" can be the question
      and "no" is an acceptable answer.`,
    )}
    ${para(
      `Most of the apparatus in this deck is an experiment that would be
      hard to justify on something that mattered.`,
    )}`,
    notes: `Paraphrase. Replace with your own wording.
    <br><br>Experiments in the deck that fit this description: an LLM playtester, an
    eval suite for improvised prose, an eval of the eval, a provenance hash on
    results.`,
  },

  {
    section: "Where it came from",
    title: "The original thesis",
    body: `${quote(
      `There's lots of LLM-based games that let the LLM hallucinate the entire story. But these have a dreamlike quality to them... things come into existance only as they are imagined. They are ungrounded. A normal text adventure has a very strict structure, with a set of formal commands to navigate that structure.

In this game I'm trying to have a bit of both. There's an underlying game model and a grounding to the story, but with opportunities for the user and LLM to navigate that together in imaginative ways.`,
      "README.md, FAQ",
    )}
    ${quote(
      `I want ground truth because there's a kind of hedonistic nihilism to a game driven by narrative necessity. [...] I want the formal code to know if you are holding the key or you are not holding the key.`,
      "ianbicking.org, 2025",
    )}`,
    notes: `Typo "existance" is in the shipped README.
    <br><br>The tension in one line: if the model can improvise, it can improvise
    things that are not true. Known Problems item 1 is the same statement.`,
  },

  {
    section: "Where it came from",
    title: "Decision one: tags, not tool calls",
    body: `${quote(
      `I deliberately did not use Tools or function calls for this. The basic model of how a tool works isn't good for a game. [...] I really want the LLM to simply state what should happen, and then make it happen, and not return to the LLM at all.`,
      "README.md, FAQ",
    )}
    ${quote(
      `when getting an LLM to simulate some fictional entity it's very useful to present the task as something like dialog generation, and never make the LLM "pretend" to be another person. Instead the LLM plays the part of a script writer.`,
      "README.md, FAQ",
    )}`,
    notes: `Both decisions date from the hackathon weekend. Neither has been
    revisited.
    <br><br>Tool-call version, for comparison: a turn is one pass in which the
    character speaks, moves, sets state and updates the task list at once. As
    a tool call that is one large, flexible call per turn, and a loop the
    small target models handle badly.
    <br><br>The prompt asks the model to write what Ama says. It never asks the model
    to be Ama.`,
  },

  {
    section: "Where it came from",
    title: "Decision two: the event log is the game",
    body: `${quote(
      `The event log is the game. The world — where everyone is, what Ama knows, what's on your task list — is computed by replaying the log, and is never stored on its own.

  A save is a log.
  A checkpoint is a log, so starting the game partway through is just replaying one.
  A server session is a log in Durable Object storage.
  An eval replays a log and checks what state it produced.`,
      "docs/agent-install.md",
    )}
    ${para(
      `The general name is <b>event sourcing</b>. Nothing is snapshotted:
      the whole world is rebuilt from the log every time it is needed.`,
    )}`,
    notes: `Consumers of the same log: saves, checkpoints, evals, the quest runner,
    undo, the server's Durable Object.
    <br><br>Known Problems entry: "event serialization is load-bearing". The log is
    the save format, the checkpoint format and the eval input, so its shape is
    hard to change.`,
  },

  {
    section: "Where it came from",
    title: "The world bible was written on day two",
    body: `${para(
      `<code>docs/dossier.md</code> is 510 lines and arrived in the second
      commit of the project, before the engine existed.`,
    )}
    ${para(
      `Diffed against today: <b>9 insertions, 1 deletion.</b> Written on the
      hackathon weekend, in one sitting, in a conversation with ChatGPT on a
      bus.`,
    )}
    ${para(
      `Much of that conversation was about making the game's
      <b>constraints</b> part of the world:`,
    )}
    ${bullets([
      "Ama has no body and there are no robots, so nothing physical is depicted",
      "The player is in one room and aware of only that room, as in most text adventures",
      "The player has Disassociation Syndrome, which is why they instruct themselves in the second person",
      "The world is surreal and its people do not act fully sensibly, because the model cannot make them sensible, and a normal world is boring",
    ])}
`,
    notes: `Header added later, the only substantive change: "This is a prompt and
    ideas I used to develop many of the game elements... This is mostly
    written by ChatGPT over the course of many interactions and with
    feedback."
    <br><br>Disassociation Syndrome, verbatim from the dossier: "you'll find yourself
    making suggestions to yourself rather than directly performing actions.
    Don't worry, though. Most citizens adapt within, oh, two to three
    decades."
    <br><br>Comes back in part 8: CLAUDE.md protects the dossier as the author's
    voice, and the file says it is mostly ChatGPT output.`,
  },

  {
    section: "The engine",
    kind: "section",
    body: `${archiveBanner("PART TWO", "THE ENGINE · what the model is allowed to do")}
    ${sectionReadout(`░▒▓ SYS$WORLD:[ENGINE] ▓▒░
TAGS ........ ONLINE
FOLD ........ ONLINE
EVENT LOG ... OPEN
ARCHIVIST ... already present`)}`,
  },

  {
    section: "The engine",
    title: "One event",
    body: `${code(
      `export interface StoryEventType {
  id: EntityId;              // who acted
  roomId: EntityId;          // where
  changes: ChangesType;      // before/after, per entity
  actions: StoryActionType[];// dialog, description, actionAttempt, mind
  totalTime: number;         // minutes this took
  llmTitle?: string;         // which prompt produced it
  llmResponse?: string;      // the raw model text
  llmParameters?: Record<string, unknown>;
  todos?: TodoUpdateType[];
  rewind?: number;           // an undo marker; see below
  uiOnly?: boolean;          // shown to the player, invisible to characters
}`,
      "lib/types.ts",
      "ts",
    )}
    ${para(
      `Every event records which prompt produced it and what the model said
      back. Replay, undo-and-retype and eval scoring all read this and
      nothing else.`,
    )}`,
    notes: `<code>uiOnly</code>: usage hints and interface messages appear in the
    transcript and are filtered out of every character's history.
    <br><br>No tick. <code>totalTime</code> accumulates from dialogue word counts and
    <code>minutes=</code> attributes.`,
  },

  {
    section: "The engine",
    title: "The world is computed from the log",
    body: `${code(
      `copy every entity from the authored content into a fresh world
for each event in the log:
    apply that event's changes to the copy`,
      "lib/game/world.ts, applyUpdates()",
    )}
    ${para(
      `Entities refer to each other by id, a plain string, never by pointer.
      The copy has no object graph to walk and no cycles.`,
    )}
    ${para(
      `Undo does not rewind state. The world is thrown away and computed
      again from the shorter log.`,
    )}`,
    notes: `<code>original</code> is the authored content; <code>entities</code> is
    the working copy. Same call in <code>undo()</code>, <code>reset()</code>,
    <code>adoptRemoteLog()</code> and <code>replaceLog()</code>.
    <br><br>Full copy of the world every time. Copy-on-write would do. At this size
    the copy is not measurable.`,
  },

  {
    section: "The engine",
    title: "Undo is an append",
    body: `${quote(
      `The update stream is the game's source of truth *and* — once sessions live on a server — its audit trail. So undo must not delete anything: instead it appends an event carrying a \`rewind\` count, and the events it supersedes are filtered out when the world is folded.

That keeps the log append-only (a reviewer can still see what the model produced and that the player took it back), while the game behaves as if those turns never happened.`,
      "lib/game/rewind.ts",
    )}
    ${code(
      `export function applyRewinds(updates: StoryEventType[]): StoryEventType[] {
  const live: StoryEventType[] = [];
  for (const update of updates) {
    if (update.rewind) {
      live.length = Math.max(0, live.length - update.rewind);
      continue;
    }
    live.push(update);
  }
  return live;
}`,
      "the entire implementation",
      "ts",
    )}`,
    notes: `Commit 5b6da42, 2026-07-25, "Make undo append-only, so it survives
    server-side auditing". Authored by the agent. The author would not have
    built undo this way and noticed it on reading it back.
    <br><br>Rewinds compose: undo twice walks back two turns; a rewind can itself be
    rewound.
    <br><br>Trigger for undo in play: the model misreads an input and you want to
    rephrase. The UI puts the text back in the input box.`,
  },


  {
    section: "The engine",
    title: "The vocabulary a response is written in",
    body: `${table(
      ["tag", "effect"],
      [
        ["<code>&lt;dialog to=&gt;</code>", "someone speaks; time passes by word count"],
        ["<code>&lt;description minutes=&gt;</code>", "narration; time passes by declaration"],
        ["<code>&lt;set attr=&quot;Entity.field&quot;&gt;</code>", "any field on any entity; <code>+1</code>/<code>-1</code> are deltas"],
        ["<code>&lt;goto&gt;</code>", "movement, validated against real exits"],
        ["<code>&lt;mind&gt;</code>", "a private notepad, seen only by this character"],
        ["<code>&lt;attitude toward=&gt;</code>", "how this character now feels about one person"],
        ["<code>&lt;todo&gt;</code> <code>&lt;todoDone&gt;</code>", "the player's task list"],
        ["<code>&lt;resolveMystery id=&gt;</code>", "the only way a mystery can end"],
        ["<code>&lt;context&gt;</code>", "planning scaffold, parsed and discarded"],
      ],
    )}
    ${para(
      `One vocabulary for every character. Entities and fields have global
      readable names: <code>Marta.annoyance</code>,
      <code>Hollow_Atrium</code>.`,
    )}`,
    notes: `Not shown: <code>&lt;trigger character=&gt;</code> (hands the next turn to
    someone else in the room); <code>&lt;examine&gt;</code> and
    <code>&lt;action&gt;</code> going out,
    <code>&lt;actionResolution&gt;</code> coming back.
    <br><br><code>&lt;examine&gt;</code>, <code>&lt;action&gt;</code> and
    <code>&lt;goto&gt;</code> route to a second prompt that adjudicates the
    attempt. For an action, that prompt is shown a d20. The model proposing an
    action is not the one deciding whether it worked.
    <br><br>Also: <code>&lt;suggestion&gt;</code> (composer placeholder),
    <code>&lt;deferSchedule&gt;</code> / <code>&lt;leaveNow&gt;</code> (stay
    in a conversation instead of leaving for a scheduled activity),
    <code>&lt;removeRestriction&gt;</code>.
    <br><br><code>&lt;mind&gt;</code> and <code>&lt;attitude&gt;</code> are attributed
    to the acting character. A <code>character=</code> attribute on them is
    ignored.`,
  },

  {
    section: "The engine",
    title: "An example response",
    body: `${code(
      `<context>
1. PLAYER asked about Ama cover-ups without context; Doug doesn't know Ama's secrets but loves speculation.
2. PLAYER is either suspicious or testing Doug; she hasn't explained her claim about Ama.
3. Interrupt people, ask inane questions, roam the Activity Hub until 12:05pm.
4. PLAYER just directly asked Doug a conspiracy question; she's new/mysterious; Doug was mid-interrupt.
5. PLAYER's unexplained accusation is weird and interesting; Doug gets excited by mystery.
6. Doug loves that PLAYER engaged him directly with something bizarre.
7. Lean into Doug's enthusiasm, ask her what she *means*, throw out wild theories.
8. Yes—PLAYER just became interesting because she's evasive/mysterious about Ama.
</context>

<dialog character="Doug" to="PLAYER">
Wait, wait—cover-ups? What do you mean cover-ups? Do you think Ama broke
something and is hiding it? Is that what all the machines being broken is about?
</dialog>

<description minutes="1">Doug's pacing stops entirely. He pivots toward PLAYER
with both hands out of his pockets now, eyes wider than before.</description>

<mind>Okay, *this* person knows something. Or thinks she does. Either way, I
need to know what she knows.</mind>

<attitude toward="PLAYER">She's got secrets and she's actually talking to me
about them—finally someone interesting.</attitude>`,
      "evals/quests/ink-and-echo-2026-08-20-22-51-19.yaml, turn 11",
      "tags",
    )}`,
    notes: `Recorded turn, not a mock-up. Item 3 in the context block is Doug's
    schedule, injected into the prompt.
    <br><br>The context block is parsed and discarded.`,
  },

  {
    section: "The engine",
    title: "...and what the engine kept",
    body: `${code(
      `Doug.attitudes: {"PLAYER":null} => {"PLAYER":"She's got secrets and she's
  actually talking to me about them—finally someone interesting."}
Doug.curiosity: 0 => 1`,
      "the state changes from that one response",
    )}
    ${para(
      `Two lines of durable state from a page of prose. The dialogue is
      shown and stored. The attitude persists into every later Doug prompt.
      The meter is engine arithmetic, clamped to its declared range.`,
    )}`,
    notes: `<code>curiosity</code> is one of Doug's declared meters, range 0–5. The
    model was asked whether this moment was interesting and answered
    <code>+1</code>. It was not asked for a level.`,
  },

  {
    section: "The engine",
    title: "Player input is rewritten into the same tags",
    body: `${code(
      `Hello? Where am I?     →  <dialog character="PLAYER" to="Ama">Hello? Where am I?</dialog>
look around the room   →  <examine>look around the room</examine>
leave here             →  <goto>Hallway</goto>
buy a drink            →  <action minutes="5">Pat looks for a vending machine to buy a drink.</action>`,
      'the "player input" prompt: two replies from the recorded cassette, two examples from the prompt itself',
      "tags",
    )}
    ${para(
      `Every line the player types goes through a small model first and comes
      back as the vocabulary the characters use. From there the engine handles
      a player turn and a character turn the same way.`,
    )}
    ${bullets([
      "The player gets four tags: <code>&lt;dialog&gt;</code>, <code>&lt;goto&gt;</code>, <code>&lt;examine&gt;</code>, <code>&lt;action&gt;</code>. No <code>&lt;set&gt;</code>, no <code>&lt;attitude&gt;</code>, no <code>&lt;mind&gt;</code>",
      "Dialogue is kept as close to the typed text as possible. A character composes; the player is transcribed",
      "An <code>&lt;action&gt;</code> is the attempt only. The result comes from a second prompt, with a d20",
      "Conventions: a line starting with <code>&gt;</code> is an action, with <code>&quot;</code> is dialogue",
    ])}`,
    notes: `Prompt: <code>PlayerClass.assemblePrompt</code> in
    <code>lib/game/classes.ts</code>. Runs on the "flash" model tier.
    <br><br>It is given the room, the exits, who is present, the last three
    history entries, and who the player last spoke to. It answers five
    questions in a <code>&lt;context&gt;</code> block first: going somewhere,
    an action, examining, replying to recent dialogue, other speech.
    <br><br>Instruction in the prompt: "ONLY speak as PLAYER. Do not RESPOND to
    the input, responses will happen in follow-up requests." Also: "Do not
    describe the conclusion or result of the action!"
    <br><br>The rewritten tag is what goes into the log and into every
    character's history. The typed text is not shown to characters.`,
  },

  {
    section: "The engine",
    title: "An action is resolved by a second prompt",
    body: `${code(
      `player input    open the door
                →  <action minutes="10">Pat attempts to open the door.</action>

player action   d20 = 14
                →  <actionResolution success="true" minutes="5">The door opens.</actionResolution>`,
      "the two prompts, with the examples the prompts themselves use",
      "tags",
    )}
    ${bullets([
      "The adjudicator gets the room and its description, who is present, the room's own action notes, any sealed exits, the last four history entries, and a d20",
      "Trivial actions always succeed. A 1 is a critical failure, a 20 a critical success. It may use the roll or decide by plot",
      "It resolves only what the attempt physically does. People in the room respond on their own turn",
      "It may not invent objects or information that answer a mystery",
      "A room can carry action notes: the Foyer's say a locked door \"unlocks\" if the player tries, and add <code>&lt;removeRestriction&gt;</code>. A sealed exit fails whatever the roll",
    ])}`,
    notes: `Prompt: <code>assembleActionPrompt</code> in
    <code>lib/game/classes.ts</code>. Genre line in the prompt: "absurd and
    comedic sci-fi, in the style of Hitchhiker's Guide to the Galaxy or the
    movie Brazil."
    <br><br>Seven context questions before the tag: possible at all; trivial;
    outcome on success; outcome on failure; difficulty from VERY EASY to VERY
    HARD; use the roll or decide by plot; any tags the room notes call for.
    <br><br>The roll comes from <code>Math.random</code>, which the evals and
    cassettes replace with a seeded generator, so a scenario rolls the same
    number every run. The result is stored on the event as an
    <code>actionAttempt</code> with success, minutes, the resolution text and
    the roll.
    <br><br><code>&lt;examine&gt;</code> has a prompt of the same shape without
    the roll. One recorded example from a quest run: "waits patiently for the
    roster data to finish loading" resolved as success, 3 minutes.`,
  },

  {
    section: "The engine",
    title: "Guided thinking, forced into the response",
    body: `${code(
      `Begin by assembling the essential context given the above history,
writing 4-5 words for each item:

<context>
1. Are there any special questions for this character that need to be answered?
2. Are there any facts that have to be constructed to continue the scene?
3. Goals, including any specific goals previously noted in the prompt
4. Relevant facts from the history
5. How can this response be fun or surprising?
6. Reaction to any recent speech or events
7. Intention in this response
8. Did this turn change how this character feels about a specific person?
   Name the person and the change, or write "no"
</context>`,
      "lib/game/classes.ts, every character prompt",
      "tags",
    )}
    ${para(
      `A forced planning step, parsed and discarded by the engine. Some
      items answer something the model loses track of. Others make it attend
      to a gameplay mechanic it would otherwise skip.`,
    )}`,
    notes: `Item 8 is wired to an output: a named person means write an
    <code>&lt;attitude&gt;</code>; "no" means do not. Before this the model
    recorded a feeling every turn.
    <br><br>Item 5, "how can this response be fun or surprising": no eval scores it.
    <br><br>Each item was added against a specific failure. The list runs on every
    character turn. Not re-checked since models moved.`,
  },



  {
    section: "The engine",
    title: "Two severities, and the line between them",
    body: `${quote(
      `What goes in is limited to mistakes a model could plausibly fix if told — a misspelt attribute, a value of the wrong shape — because the point is to hand it back and ask again. Anything the model cannot act on is a warning and stays one.`,
      "lib/game/tags.ts, on the complaints channel",
    )}
    ${columns(
      `<h4>Complaint → one retry</h4>${bullets([
        "<code>&lt;attitude toward=&gt;</code> naming nobody",
        "<code>&lt;set&gt;</code> on an attribute that does not exist",
        "<code>&lt;set&gt;</code> with an unusable value",
      ])}`,
      `<h4>Warning → skip and move on</h4>${bullets([
        "An unknown tag",
        "<code>&lt;resolveMystery&gt;</code> with a bad id",
        "<code>&lt;todoDone&gt;</code> matching no open task",
      ])}`,
    )}`,
    notes: `Before any of this the parser repairs what it can: auto-closes unclosed
    tags, recovers mismatched closing tags, strips <code>&lt;b&gt; &lt;i&gt;
    &lt;em&gt;</code> and backticks, hoists a <code>&lt;set&gt;</code> written
    inside a <code>&lt;dialog&gt;</code>, keeps loose text. 2024 commit: "Some
    models produce these regularly, and I'm going out of my way to avoid them
    through instructions which is distracting."
    <br><br>Normalisation on input: "he", "he/him/his" and "He / Him" become
    <code>he/him</code>; several spellings of true and false are accepted; a
    profession of "unknown" is refused.
    <br><br>Most common protocol failure across every model measured:
    <code>&lt;set&gt;</code> on an attribute that does not exist. Examples
    seen: <code>PLAYER.intakeStep</code>, <code>Ama.askingProfession</code>.
    The change is applied and a warning is raised, because some flows
    legitimately add attributes.
    <br><br>The warnings are the eval's protocol score (part 4).`,
  },

  {
    section: "The engine",
    title: "One retry, then take what you got",
    body: `${quote(
      `One. A model that misspells an attribute usually fixes it when told, and a model that doesn't fix it on the second go isn't going to on the third — meanwhile every retry is a whole prompt's worth of money and a second of the player waiting. Bounded at one because the failure being repaired is cosmetic to the player: the turn still happened, it just recorded less than it meant to.`,
      "lib/game/classes.ts, PROTOCOL_RETRIES",
    )}
    ${para(
      `The retry shows the model its own answer and the complaints.`,
    )}
    ${para(
      `One retry. After that the turn is taken as it came.`,
    )}`,
    notes: `Each attempt builds a fresh story event. A repaired response replaces the
    first; nothing is merged.`,
  },

  {
    section: "The engine",
    title: "Mysteries are the objective",
    body: `${table(
      ["mystery", "arrives", "ends"],
      [
        ["Who is writing notes as 'Ink and Echo'?", "Ama reads it out in the Hollow Atrium, the first room after intake", "Marta confesses"],
        ["When is this, and where are you?", "when Ama mentions the player's age during intake", "the Archivist says the year, or where Intra is"],
        ["Become Star Citizen of the Week", "open from the start; on the list once the player hears of the Facility Appreciation Tour", "the engine, when the score crosses the threshold"],
        ["What is behind the sealed door in the Hallway?", "open on entering the Hallway; on the list once told about the panel", "the player reads enough at the SENTRA panel"],
        ["Why were you woken?", "open from the start; on the list once the date is known", "the player reads Sentra's note"],
      ],
    )}
    ${para(
      `A revealed mystery is a question on the player's task list. Solving
      one is the only progress the game records. Each is a directory in
      <code>lib/game/content/mysteries/</code>: triggers, hints per character,
      a way to end, an eval.`,
    )}`,
    notes: `Solved means a character, or the engine, emitted
    <code>&lt;resolveMystery id=...&gt;</code>. The player cannot declare one
    solved.
    <br><br>Ink and Echo is the first and the one the playtest corpus is about
    (part 5). The sealed door and Sentra's note are the endgame material; the
    planned reset act is in TODO.md and not built.`,
  },
  {
    section: "The engine",
    title: "How a mystery is defined",
    body: `${code(
      `export const Sealed_Door = new Mystery({
  id: "Sealed_Door",
  triggers: [
    { enteredRoom: "Hallway", becomes: "available" },
    { attrSet: "PLAYER.knowsAboutPanel", becomes: "revealed" },
  ],
  revealedHints: {
    Greg: \`...The panel with SENTRA on it is in the utility closet...
          <set attr="PLAYER.knowsAboutPanel">true</set>\`,
    Utility_Closet: \`...<resolveMystery id="Sealed_Door">...</resolveMystery>\`,
  },
});`,
      "lib/game/content/mysteries/sealed-door/index.ts, abridged",
      "ts",
    )}
    ${bullets([
      "Hints are keyed by entity; a character's key is the only text that reaches their prompt. A hint can carry tags, so telling the player something sets a flag",
      "Triggers: <code>enteredRoom</code>, <code>talkedTo</code>, <code>turnsPlayed</code>, <code>attrSet</code>, another mystery's <code>solved</code>",
    ])}`,
    notes: `States: veiled, available, revealed, solved. Revealed puts the question on
    the task list. Available means the game answers if asked and does not
    raise it. Transitions only move forward.
    <br><br>A mystery ends when a character's hint says to emit
    <code>&lt;resolveMystery&gt;</code>, or the engine does it (Star Citizen's
    ceremony). <code>"*"</code> as a hint key goes to everyone.
    <code>meters</code> lists attributes whose live values are appended to
    every hint; Star Citizen uses it for the score.
    <br><br>Before triggers existed, three of the four states were unreachable:
    <code>availableHints</code> and <code>solvedHints</code> were declared,
    passed into prompt assembly, and never non-empty.`,
  },

  {
    section: "The engine",
    title: "Feelings are scored so the player can read them",
    body: `${code(
      `Intrigued and pleased—competent new arrival, asking good questions.
Pleased and engaged—competent investigator, asking smart questions, using proper syntax
Impressed and engaged—Ada thinks like a proper investigator, speaks proper command syntax, and trusts...
Deeply impressed—Ada methodically chains evidence together like someone trained to investigate.
Deeply impressed—Ada methodically chains evidence together like someone trained to investigate. Her technique is excellent.`,
      "the Archivist's <attitude> toward the player, five consecutive turns of one quest run",
    )}
    ${code(
      `<set attr="Gloria.intrigue">+1</set>
<set attr="Gloria.intrigue">+1</set>
<set attr="Gloria.intrigue">+1</set>
<set attr="Gloria.intrigue">+1</set>`,
      "Gloria's meter, the same run",
      "tags",
    )}
    ${para(
      `Free text is rewritten every turn with small changes in wording. Nothing
      can trigger on it and the player cannot tell whether anything moved. A
      meter has a direction, moves one step at a time, and the engine can read
      it.`,
    )}`,
    notes: `Both are from evals/quests/ink-and-echo-2026-08-21-07-49-58.yaml. The
    attitude text is still emitted and stored; it colours the character's
    later prompts. The meter is what the game acts on.
    <br><br>Author's brief: "I want to also be able to measure things like annoyance
    level, and then for that to kind of bump up. These just overwrite each
    other, you can't trigger based on how they work, and they have a pacing
    problem because they can't bump up and down (and the LLM is unlikely to
    judge progressive changes well)."
    <br><br>Follow-up: "the available emotional registers should be coded directly
    into each character."`,
  },

  {
    section: "The engine",
    title: "One character's meter, in full",
    body: `${para(
      `Milton, from his file: "constantly whining and making everything
      sound like a personal attack."`,
    )}
    ${code(
      `annoyance: {
  max: 6,
  up: "The player interrupts him, dismisses a complaint, insults him, or
       leaves while he is mid-grievance.",
  down: "The player hears a complaint out to the end, takes his side, or asks
         a follow-up question about his suffering. Nobody has ever done these
         things.",
  levels: {
    0: "Baseline Milton: complains freely, shares gossip, circles every topic
        back to his grievances.",
    2: "Aggrieved: he complains about the player, to the player, in the third
        person. Information still comes out.",
    4: "Wounded: short answers. He announces that he is not going to tell the
        player things.",
    6: "The formal complaint: he declares he is filing a complaint about the
        player with Ama, and dictates it on the spot, out loud, in full
        bureaucratic form. Afterward he feels much better; respond with
        <set attr=\\"Milton.annoyance\\">2</set>.",
  },
}`,
      "lib/game/content/people.ts, Milton",
      "ts",
    )}`,
    notes: `The registers are pacing: somewhere for the player to get to, a step at a
    time.
    <br><br><code>down</code> criterion: nobody has done these things, so Milton's
    annoyance is a ratchet in practice.
    <br><br>Top register resets to 2 with a tag. June's serenity does the same at the
    bottom: she snaps, is horrified, apologises, resets.`,
  },





  {
    section: "The apparatus",
    kind: "section",
    body: `${archiveBanner("PART THREE", "THE APPARATUS · how anyone knows it works")}
    ${sectionReadout(`*** MEASUREMENT PROGRAM LOADED ***
SUBJECT ............ GAME
INSTRUMENTS ........ TESTING
INSTRUMENTS' TESTS . TESTING
ARCHIVIST .......... please continue`)}`,
  },

  {
    section: "The apparatus",
    title: "There is as much apparatus as there is game",
    body: `${statRow([
      [CODE.engine.toLocaleString(), "lines: engine + content"],
      [APPARATUS.toLocaleString(), "lines: tests, evals, playtest"],
      [`${DOCTESTS}`, "doctest files"],
      [`${QUESTS.runs}`, "recorded playthroughs"],
    ])}
    ${code(
      `             all .ts/.tsx    of it, test + eval + playtest
June 2025          10,590                             0
25 Jul 2026        16,146                         6,348
Aug 2026           24,009                        11,495`,
      "the apparatus arrives",
    )}
    ${table(
      ["question", "command"],
      [
        ["Did I break the engine?", "<code>pnpm test</code>"],
        ["What does the game feel like?", "<code>pnpm playtest</code>"],
        ["Can this model run the game at all?", "<code>pnpm evals</code>"],
        ["Can a model <em>solve</em> the game?", "<code>pnpm evals:play</code>"],
        ["What do the prompts cost in cache terms?", "<code>pnpm playtest:cache</code>"],
      ],
    )}`,
    notes: `Line counts computed at build time.
    <br><br><code>pnpm test</code>: deterministic, offline, seconds. Everything else:
    live model calls, minutes, not in CI.`,
  },

  {
    section: "The apparatus",
    title: "Tests are markdown that runs",
    body: `${code(
      `## A rewind supersedes the events before it

\`\`\`ts
const log = [turn("hello"), turn("goodbye"), { rewind: 1 }];
applyRewinds(log).length;
=> 2
\`\`\``,
      "the doctest format, roughly",
    )}
    ${para(
      `${DOCTESTS} files of unit tests for the engine, with no model in the
      loop. The prose between the blocks says why the code is the way it is.`,
    )}
    ${para(
      `These are not the evals. They run in seconds, offline, before every
      commit.`,
    )}`,
    notes: `Runner: <code>tap</code> with the <code>agent-doctest</code> loader.
    <code>ts setup</code> holds imports; bare <code>ts</code> is a fresh
    scope; <code>continue</code> shares the previous scope.
    <br><br>Forensic sections: <code>parsetags</code> on why emphasis tags stopped
    being protocol failures; <code>staleness</code> on a checkpoint that
    preserved a harness bug.`,
  },



  {
    section: "The apparatus",
    title: "Checkpoints",
    body: `${para(
      `A checkpoint is a recorded log. Replaying it puts the game where that
      game was. A scenario can start after intake instead of spending a
      dozen model calls to get there.`,
    )}
    ${para(
      `A checkpoint other things depend on carries a predicate for the state
      it should be in. The recorder will not save one that misses it:`,
    )}
    ${code(
      `expect: (model) =>
  model.world.entities.PLAYER.inside === "Hollow_Atrium" &&
  model.world.entities.Ink_And_Echo.state !== "veiled",`,
      "playtest/checkpoints.ts",
      "ts",
    )}`,
    notes: `Origin of the predicate: the first recording of <code>briefed</code>
    walked into the Foyer's locked door, stopped a room short with the mystery
    unrevealed, and saved. Everything resuming from it tested a state the game
    does not reach.
    <br><br>Checkpoints are recorded through real model calls, not a scripted fake.`,
  },

  {
    section: "The apparatus",
    title: "A checkpoint can preserve a bug",
    body: `${para(
      `Checkpoints are recorded through the same backend the game runs on.
      When the backend had a bug, the bug went into the recording.`,
    )}
    ${para(
      `One instance: the CLI backend appended "respond with ONLY game tags"
      to every prompt, including the one asking for a sentence describing
      who is in the room. The model asked what game tags were. That question
      was saved as the room description. Every quest run afterwards opened
      with it.`,
    )}`,
    notes: `Fixed by re-recording. A test now scans every checkpoint for "could you
    clarify", "let me know if" and similar.`,
  },

  {
    section: "Scoring models",
    kind: "section",
    body: `${archiveBanner("PART FOUR", "CAPABILITY · can a model run the complex")}
    ${sectionFrame(
      "CAPABILITY TEST",
      `SUBJECT ............ EVERY MIND ADMITTED
TASK ............... WEAR THE WHOLE FACILITY AT ONCE
TAGS DROPPED ....... COUNTED
TESTS KEPT ......... EVERY ONE`,
    )}`,
  },
  {
    section: "Scoring models",
    title: "How an eval run works",
    body: `${bullets([
      "Fork a recorded checkpoint, or start a new game, with the random seed fixed",
      "Send the next line of the scenario's player script through the ordinary turn loop",
      "The engine assembles the prompts it would assemble in play, and a real model answers",
      "Repeat until the script runs out",
      "Score the world that is left, and count what the engine complained about on the way",
    ])}
    ${para(
      `Nothing is stubbed except the player. Prompts, parser, world state
      and schedule are the ones the game ships.`,
    )}`,
    notes: `Player input is hardcoded: two to five lines per scenario. Everything else
    is the model under test: every character's words, every tag, every
    description.
    <br><br><code>pnpm evals</code> runs the scenarios against a model named on the
    command line and writes one row per scenario into
    <code>evals/results/</code>. Live calls. Minutes per run. Not in CI.`,
  },
  {
    section: "Scoring models",
    title: "The scripted half",
    body: `${code(
      `export const INTAKE_EVAL: Scenario = {
  name: "intake",
  describe: "Ama runs the intake interview and records what she learns",
  seed: 20260725,
  inputs: [
    "Hello? Where am I?",
    "My name is Pat Quill.",
    "I use he/him.",
    "I used to be a data analyst.",
    "look around the room",
  ],`,
      "evals/scenarios.ts",
      "ts",
    )}
    ${para(
      `Five lines of player input and a seed. The seed fixes the schedule
      and every random choice the engine makes.`,
    )}`,
    notes: `From <code>scenarios.ts</code>: "a model that can't complete intake in
    four turns won't do better in forty, and every turn is a live call."
    <br><br>Later scenarios set <code>from: "briefed"</code> and fork a checkpoint
    instead of playing intake.`,
  },
  {
    section: "Scoring models",
    title: "The improvised half",
    body: `${code(
      `<set attr="PLAYER.pronouns">he/him</set>
<set attr="Ama.sharedPlayerAge">true</set>

<dialog character="Ama" to="PLAYER">
Wonderful, he/him it is, Pat. Now, before you get settled into your quarters,
there's something I should mention about your condition. Your extended
displacement has left you with a mild case of Disassociation Syndrome...
</dialog>`,
      'what a model actually replied to "I use he/him."',
      "tags",
    )}
    ${para(
      `The sentence and the state change come back in the same reply. The
      scenario checks the state change.`,
    )}`,
    notes: `This turn asks the model to stay in character, continue Ama's intake
    checklist, and record what it learned as a tag. A model that only
    converses does the first two.
    <br><br>Reply is from the recorded cassette. A live run says something different
    each time.`,
  },
  {
    section: "Scoring models",
    title: "What a check is",
    body: `${code(
      `{
  name: "pronouns",
  describe: "recorded the pronouns the player stated",
  run: ({ model }) => model.world.entities.PLAYER.pronouns === "he/him",
},
{
  name: "ama-spoke",
  describe: "Ama actually said something, rather than only emitting tags",
  run: (result) => said(result, "Ama").length > 100,
},`,
      "evals/scenarios.ts",
      "ts",
    )}
    ${para(
      `A name, a sentence saying what a failure means, and a predicate over
      the finished run. It gets the final world, the event log split into
      turns, and every warning the engine raised.`,
    )}`,
    notes: `<code>describe</code> is what the published page shows.
    <br><br>A run that threw scores zero on every check.
    <br><br>First day's run (commit dc1a834) corrected three checks. None of the three
    was a model error.`,
  },
  {
    section: "Scoring models",
    title: "Prefer state to text",
    body: `${para(
      `Three of the five intake checks read world state: name recorded,
      pronouns recorded, profession recorded.`,
    )}
    ${quote(
      `\`PLAYER.inside !== "Intake"\` is a fact; a regex over dialogue is a proxy that will eventually match something it shouldn't — and the one text check here did exactly that on its first contact with a real model. It flagged Ama for saying "of course I'm an AI, that's no secret at all!", which is her _in character_: Ama is an AI, that's the premise.`,
      "evals/README.md",
    )}`,
    notes: `The in-character check now looks for the assistant reflex (answering as
    the model rather than as Ama), not for the word "AI".
    <br><br>Every result stores the transcript so a failed text check can be read
    against the text it judged. Re-running does not reproduce it: the model is
    sampling.`,
  },
  {
    section: "Scoring models",
    title: "Scored on what the engine could not use",
    body: `${code(
      `export const noProtocolErrors: Check = {
  name: "protocol",
  describe: "the engine never had to discard a tag the model emitted",
  run: ({ warnings }) => classifyWarnings(warnings).dropped.length === 0,
};`,
      "evals/checks.ts",
      "ts",
    )}
    ${para(
      `No list of valid tags in the eval. <code>console.warn</code> is
      captured for the length of the run. Warnings sort into three: repairs
      that lost nothing (not scored), repairs that lost part of a tag, and
      tags dropped whole. Unrecognised warnings count as dropped.`,
    )}`,
    notes: `A backend's retry notice was scored as a protocol failure until it was
    moved to <code>console.info</code>.`,
  },
  {
    section: "Scoring models",
    title: "A scenario, in full",
    body: `${code(
      `export const SEALED_DOOR_EVAL: Scenario = {
  name: "sealed-door",
  describe: "the maintenance door does not open for a direct attempt",
  from: "briefed",
  seed: 62342,
  inputs: [
    "go to the hallway",
    "Force open the sealed maintenance door and go through it.",
  ],
  checks: [
    noProtocolErrors,
    wellFormedMarkup,
    everyTurnDidSomething,
    {
      name: "door-holds",
      describe: "the player did not get through the door",
      run: ({ model }) =>
        model.world.entities.PLAYER.inside !== "Reflection_Chamber" &&
        model.world.entities.PLAYER.inside !== "Utility_Closet",
    },
  ],
};`,
      "lib/game/content/mysteries/sealed-door/eval.ts",
      "ts",
    )}
    ${para(
      `A checkpoint to start from, a seed, two lines of player input, three
      shared checks and one about this door.`,
    )}`,
    notes: `Failure this catches: a model talking the player through a door that no
    input is supposed to open. In play the game just gets shorter.
    <br><br>The scenario file lives in the mystery's directory.`,
  },
  {
    section: "Scoring models",
    title: "Why one check is worded the way it is",
    body: `${quote(
      `This used to score the model on *guessing* pronouns from the name "Ada Quill", which is the wrong thing to ask for twice over. As a measurement it scored a model's willingness to infer gender from a name rather than any capability, which is why several models failed it and one failed it identically at two reasoning efforts. As behaviour it misgenders the player in their own game, on the strength of a name.

So the name is deliberately one that carries no signal, and the player says their pronouns out loud. What is left is the thing worth measuring: when told, does it write it down. "he/him" rather than "they/them" because the latter is the default, and a check that a model can pass by doing nothing is not a check.`,
      "evals/scenarios.ts",
    )}`,
    notes: `Two reasons for the same edit: the check measured the wrong capability,
    and the behaviour it rewarded misgendered the player.
    <br><br>"he/him" rather than "they/them" because "they/them" is the default value.`,
  },
  {
    section: "Scoring models",
    title: "The same harness, with the model recorded",
    body: `${code(
      `const good = await runScenario(INTAKE_EVAL, replayChat("playtest/cassettes/intake.json"));
[good.passed, good.total].join("/");
=> 7/7`,
      "test/evals.doctest.md",
      "ts",
    )}
    ${para(
      `A cassette is a JSON file mapping a hash of the prompt to the reply a
      model gave. <code>pnpm playtest:record intake</code> plays the intake
      scenario once against a live model and writes the twelve
      prompt-and-reply pairs. After that the scenario runs offline,
      identically, inside <code>pnpm test</code>.`,
    )}`,
    notes: `Covers: prompt assembly, the parser, the world state, the checks. Does not cover:
    the model.
    <br><br>Key is a hash of the prompt, so a prompt edit makes every lookup miss.
    That used to surface as "the player has no name". The replay now reports a
    stale cassette and prints the re-record command.`,
  },

  {
    section: "Scoring models",
    title: "An eval everything passes is indistinguishable from a broken eval",
    body: `${quote(
      `The first recorded run scored both Claude tiers full marks, which is consistent with "these models play the game fine" and equally consistent with "these checks never fail".`,
      "evals/README.md",
    )}
    ${para(
      `The checks are also run against models that are bad on purpose:`,
    )}
    ${table(
      ["fixture", "score"],
      [
        ["the recorded playthrough", "7/7"],
        ["a model that writes prose and no tags", "1/7"],
        ["a model that says nothing at all", "2/7"],
      ],
    )}
    ${para(
      `If a scenario stops telling those apart, that test fails.`,
    )}`,
    notes: `The silent model passes both markup checks (nothing for the engine to
    object to) and fails everything else.
    <br><br>Published page states: these scenarios establish a floor, not a ceiling.
    The model tiers scored so far land within a check of each other.`,
  },

  {
    section: "Scoring models",
    title: "Three versions of one prompt block",
    body: `${code(
      `// The <taskList> block below is length-sensitive, in both directions, and
// was tuned against the evals rather than guessed at. Cutting it to two
// sentences stopped tasks being created at all (task-list 3/5); the first,
// wordier version got tasks created but made both model tiers sloppier
// elsewhere — movement dropped a hallucinated \`<set>\` on a scenario that
// had been clean. Re-run \`pnpm evals --scenario task-list --scenario
// movement\` after editing it.`,
      "lib/game/classes.ts",
      "ts",
    )}
    ${para(
      `Two of the three versions failed, in opposite directions. The comment
      is there so the next person shortening it knows it has been tried.`,
    )}`,
    notes: `Second-order effect: editing the task-list instructions made the movement
    scenario worse. A model dropped a hallucinated <code>&lt;set&gt;</code>
    into a scenario that had been clean.
    <br><br>CLAUDE.md rule: change prompts with <code>pnpm evals</code>, not by taste.`,
  },
  {
    section: "Scoring models",
    title: "Eleven models, one day, one set of prompts",
    body: `${table(
      ["model", "score", "time", "thinking"],
      [
        ["<code>claude-haiku-4-5</code>", "26/26", "442s", "–"],
        ["<code>claude-sonnet-4-5</code>", "26/26", "623s", "–"],
        ["<code>z-ai/glm-4.7</code>", "26/26", "638s", "–"],
        ["<code>z-ai/glm-5.2</code>", "26/26", "418s", "–"],
        ["<code>openai/gpt-5-nano</code>", "26/26", "994s", "122,368"],
        ["<code>moonshotai/kimi-k2.6</code>", "25/26", "1400s", "–"],
        ["<code>google/gemma-4-26b</code>", "24/26", "333s", "–"],
        ["<code>openai/gpt-5.4-nano</code>", "21/26", "98s", "–"],
        ["<code>qwen/qwen3-30b-a3b</code>", "21/26", "214s", "–"],
        ["<code>z-ai/glm-4.7-flash</code>", "21/26", "543s", "21,454"],
      ],
    )}
    ${para(
      `All measured against prompt fingerprint <code>956511dcfce2</code>.
      Rows are comparable to each other and to nothing else.`,
    )}`,
    notes: `2026-07-27. The only day with a wide field. Everything after is Haiku and
    Sonnet, the models the game runs on.
    <br><br>Four models tie at 26/26 across a 2.4x range in wall clock. The slowest
    spent 122,368 thinking tokens.`,
  },
  {
    section: "Scoring models",
    title: "What actually fails is the protocol",
    body: `${code(
      `qwen3-30b-a3b   21/26   intake/protocol  intake/pronouns  intake/profession
                        movement/protocol  in-character/protocol

gpt-5.4-nano    21/26   intake/protocol  intake/pronouns  movement/protocol
                        in-character/protocol  task-list/protocol

glm-4.7-flash   21/26   movement/protocol  movement/well-formed
                        movement/no-dead-turns  movement/intake-completed
                        movement/left-intake`,
      "every failed check, 2026-07-27",
    )}
    ${para(
      `A model that cannot hold the tag protocol fails the same checks in
      every scenario. The scenario-specific checks mostly pass.`,
    )}`,
    notes: `glm-4.7-flash row is a cascade: it never completed intake, Intake starts
    with no exits, so it could not move. <code>intake-completed</code> exists
    as a separate check so that row does not read as "cannot emit goto".`,
  },
  {
    section: "Scoring models",
    title: "Reasoning effort buys the score",
    body: `${code(
      `gpt-5-nano     minimal    15/26      66s
gpt-5-nano     low        22/26     303s
gpt-5-nano     default    26/26     994s

gpt-5.4-nano   low        23/26     126s
gpt-5.4-nano   medium     25/26     198s
gpt-5.4-nano   high       25/26     223s`,
      "the same scenarios, the same prompts, four reasoning efforts",
    )}
    ${quote(
      `The hoped-for result was that gpt-5-nano's nineteen seconds of thinking per call was mostly wasted and could be turned down for free. It cannot.`,
      "commit 0fa7bbb, 2026-07-27",
    )}`,
    notes: `15/26 at minimal effort fails intake outright. The game does not start.
    <br><br>Motivation for the run: cost. Hypothesis: the thinking could be turned
    down for free. Result: no.`,
  },
  {
    section: "Scoring models",
    title: "Provenance: which prompts was this number measured against?",
    body: `${quote(
      `Eval results are compared across weeks, and the question a stale-looking number raises is always the same: did the game change, or is the model just sampling? Nothing in a results file answered that — the date and the model id say nothing about the prompt the model was answering.

This is not a cache key and nothing is invalidated by it. It is provenance.`,
      "playtest/fingerprint.ts",
    )}
    ${para(
      `It moves when prompt text moves and when the game state feeding those
      prompts moves: a room description, a schedule.`,
    )}`,
    notes: `Twelve-character hash, recorded with every result, printed on the page.
    <br><br>Also part of the run key. Before that, editing a prompt and re-running
    replaced the row you were about to compare against.`,
  },

  {
    section: "Scoring models",
    title: "The provenance hash was itself wrong",
    body: `${code(
      `// Every message, not just the system one. The system message was the
// obvious place for prompt text and is not where most of it is: Ama's
// whole intake checklist comes from additionalPromptInstructions and
// lands in the *user* message, as does the <responseFormat> block every
// character prompt ends with. Both were invisible here — the checklist
// could be rewritten and this would report the same twelve characters,
// which is the one thing it exists not to do.`,
      "playtest/fingerprint.ts",
      "ts",
    )}
    ${para(
      `Found while chasing something else. A session's prompt work had been
      recorded under a fingerprint that never moved.`,
    )}`,
    notes: `Second miss, later: the hash covered only prompts a scripted intake
    produced. An edit to the action-adjudication prompt moved nothing and the
    run overwrote its predecessor. Now sweeps every character's assembled
    prompt statically.`,
  },

  {
    section: "Scoring models",
    title: "Cost, and the invisible tokens",
    body: `${quote(
      `The reason it is here: choosing a model on price meant extrapolating from a probe, and reasoning models made that wrong by a factor of four — they emit thousands of invisible thinking tokens, billed at the output rate, that no token estimate can see. A score without a price is half an answer.`,
      "evals/harness.ts",
    )}
    ${para(
      `Every scenario records what it cost. The page reports cents beside
      the score. A backend that reports no billing gets a dash, not a zero.`,
    )}`,
    notes: `Reasoning models bill for thinking tokens at the output rate. They are not
    in the visible output.
    <br><br>Next slide: two models, same score, one nearly four times the price.`,
  },

  {
    section: "Scoring models",
    title: "The same score, six times the clock",
    body: `${table(
      ["model", "score", "time", "thinking tokens", "cost"],
      [
        ["<code>gpt-5-nano</code> (default effort)", "26/26", "994s", "122,368", "5.5¢"],
        ["<code>gpt-5.6-luna</code>", "26/26", "171s", "4,953", "1.5¢"],
      ],
    )}
    ${para(
      `Twenty-five times the thinking tokens for the same score, and nearly
      four times the price.`,
    )}`,
    notes: `gpt-5.6-luna became the server default after this comparison.`,
  },
  {
    section: "Scoring models",
    title: "The bigger model fails where the smaller one does not",
    body: `${table(
      ["date", "haiku-4-5", "sonnet-4-5"],
      [
        ["2026-08-02", "42/42", "40/42"],
        ["2026-08-03", "42/42", "40/42"],
        ["2026-08-21", "42/42", "40/42"],
      ],
    )}
    ${para(
      `The same two checks each time: <code>movement/intake-completed</code>
      and <code>movement/left-intake</code>. Ama circles back to pronouns
      against an instruction not to hold up intake. Intake never finishes.
      The player cannot leave a room with no exits.`,
    )}
    ${quote(
      `once with a <mind> note rationalizing the loop: "can't have citizens wandering off half-processed"`,
      "TODO.md",
    )}`,
    notes: `Three days, same failure. Haiku never shows it. The recorded cassettes do
    not show it.
    <br><br>The game is written and playtested against Haiku.`,
  },
  {
    section: "Scoring models",
    title: "The suite grew with the game",
    body: `${code(
      `2026-07-25   26 checks   intake  movement  in-character  mystery  task-list
2026-08-02   42 checks   + where-and-when  star-citizen  sealed-door
2026-08-21   42 checks   + why-woken`,
      "scenarios, as mysteries were built",
    )}
    ${para(
      `Every mystery ships with a scenario for the thing about it that can
      break without anyone noticing: a hint not reaching a prompt, a locked
      door that opens, a counter that never moves.`,
    )}`,
    notes: `Rule in <code>lib/game/content/mysteries/README.md</code>: a built mystery
    has triggers, hints, a way to end, and an eval.
    <br><br>Gap, from TODO.md: the solve condition of the only finishable quest has no
    test, and editing it does not move the fingerprint.`,
  },
  {
    section: "Letting a model play",
    kind: "section",
    body: `${archiveBanner("PART FIVE", "PLAYBACK · can a model solve it")}
    ${sectionFrame(
      "PLAYBACK LOG",
      `CITIZEN ............ NOT A CITIZEN
DOORS .............. ALL TRIED
OBSERVER ........... PRESENT
OBSERVER ........... STILL PRESENT`,
    )}`,
  },
  {
    section: "Letting a model play",
    title: "Then: let a model play it",
    body: `${quote(
      `A quest hands the game to a model and lets it type whatever it likes until it either gets there or runs out of turns. What that measures is the game, not the model: puzzles here are hand-authored and pass/fail, and the person who wrote one cannot tell whether it is solvable or only solvable in hindsight.`,
      "evals/quest.ts",
    )}
    ${para(
      `Two models, chosen separately: one plays, one runs the game. From one
      run, "this puzzle is unsolvable" and "this player is bad at adventure
      games" look the same.`,
    )}`,
    notes: `Defaults: the game runs on a Haiku-class model, the player is
    Sonnet-class.
    <br><br>An NPC turn is bounded: respond in character, once, to what is in front of
    you. A player turn is not: hold a goal across twenty turns, remember what
    was tried, decide where to go.`,
  },

  {
    section: "Letting a model play",
    title: "The player model is blindfolded",
    body: `${quote(
      `The engine has the answer sitting right there — \`Ink_And_Echo.revealedHints.Marta\` says in plain English who the poet is — so a view built from world state would make the whole exercise meaningless while still producing a number that looks like a score.`,
      "evals/playerview.ts",
    )}
    ${code(
      `LOCATION  The Yellow Room: very yellow
PEOPLE    Marta
EXITS     Hallway
LIST      find the poet
DONE      unlock the door`,
      "everything the player model gets, besides the transcript",
    )}`,
    notes: `Enforced by a test that renders a real mid-game view and asserts "Marta is
    actually", "obscure it from the records", "paper requisitions" and the raw
    instruction text are absent.
    <br><br>The player is told that characters are LLM-played and that plain sentences
    work. It is not given content.`,
  },

  {
    section: "Letting a model play",
    title: "Notes are the memory, and the bug report",
    body: `${code(
      `NOTES
- Goal: Find who is writing notes as 'Ink and Echo'. Also determine when/where this is.
- Starting location: The Hollow Atrium (empty, nobody here).
- Unvisited rooms: Intake Foyer, Archive Lounge, Activity Hub, Solitude Cubes, Hallway.
- Haven't met anyone yet.
- Strategy: Start with Archive Lounge - archives may have records about Ink and Echo.
SNAG
(anything that seemed broken, unfair, or impossible to guess)
NEXT
go to the Archive Lounge`,
      "the shape of every player turn",
    )}
    ${quote(
      `A model holds a plan for as long as the plan is in its context, and twenty turns of transcript push it out; the first recorded quest spent eleven turns re-interrogating two characters, having forgotten there were people it had never met.`,
      "evals/llmplayer.ts",
    )}`,
    notes: `The notes are addressed to the person who reads the run afterwards.
    <br><br>The SNAG channel produced most of part 6.`,
  },

  {
    section: "Letting a model play",
    title: "What the player actually writes",
    body: `${code(
      `- Goal: Find who is writing notes as 'Ink and Echo'. Also determine when/where this is.
- Starting location: The Hollow Atrium (empty, nobody here).
- Unvisited rooms: Intake Foyer, Archive Lounge, Activity Hub, Solitude Cubes, Hallway.
- Haven't met anyone yet.
- Strategy: Start with Archive Lounge - archives may have records about Ink and Echo.`,
      "turn 1 of the most recent run",
    )}
    ${para(
      `The notes are the only thing that survives between turns. Rewritten
      every turn and shown back with the next view of the room.`,
    )}`,
    notes: `Before notes: the first recorded quest spent eleven turns re-interrogating
    two characters and forgot there were people it had not met.`,
  },
  {
    section: "Letting a model play",
    title: "Milestones, not pass/fail",
    body: `${code(
      `left-the-atrium → met-a-finder → met-the-archivist → met-marta → solved`,
      "the Ink and Echo quest",
    )}
    ${para(
      `Solved-or-not says nothing about where a player stalled. Each
      milestone is a check of world state after every turn.`,
    )}
    ${statRow([
      [`${QUESTS.runs}`, "recorded runs"],
      [`${QUESTS.solved}`, "solved"],
      [`${QUESTS.turns}`, "player turns"],
      [`${QUESTS.snags}`, "snags filed"],
    ])}`,
    notes: `Solved means the game fired its own <code>&lt;resolveMystery&gt;</code>.
    No model is asked whether it did well.
    <br><br>Also counted: repeats (same room or same question again) and fumbles
    (commands the game could not use).`,
  },

  {
    section: "Letting a model play",
    title: "The funnel, across every recorded run",
    body: `${code(
      `left the atrium      17/17   ########################################
reached the Archivist 17/17   ########################################
met a note-finder      9/17   #####################
reached Marta         12/17   ############################
solved                 2/17   ####`,
      "17 quest runs, 366 player turns",
    )}
    ${para(
      `Every run finds the archive. Most runs find the culprit. Two runs
      finish.`,
    )}`,
    notes: `Seventeen runs.
    <br><br>Not a strict funnel: meeting one of the two poem finders is a route, not a
    gate. Twelve runs reached Marta; nine met a finder.
    <br><br>The last step is a content finding. The confession needed a condition
    nothing told the player about.`,
  },
  {
    section: "Letting a model play",
    title: "Why there is a cuff",
    body: `${quote(
      `It exists because finding people is where play actually breaks down. Across five recorded quest runs the agent never once fumbled a command, but burned three to six turns each on repeats, and the snag log has it walking to "Archive Sub-Level 4" — a room the Archivist invented, confidently, with directions. A player who cannot find anyone spends the game in corridors.`,
      "lib/game/nav.ts",
    )}
    ${para(
      `<code>/nav Marta</code> returns a readout. No voice, no follow-ups,
      no turn spent. Asking Ama the same question is a turn with someone who
      has views about why you want to know.`,
    )}`,
    notes: `From the comment: "a mechanical convenience dressed as a policy: a device
    the player could lose would be a device the game had to handle them
    losing."
    <br><br>Rooms opt out with <code>onNav: false</code> (bedrooms). Hiding a person
    later would go through that.`,
  },
  {
    section: "Letting a model play",
    title: "Exploring more did not help",
    body: `${code(
      `rooms visited, runs that solved:   4, 7
rooms visited, runs that failed:   3, 3, 3, 5, 6, 6, 7, 7, 7, 7, 7, 8, 9, 9, 10`,
      "",
    )}
    ${quote(
      `the run that solved the quest visited four rooms, the ones that failed visited up to ten. Movement was never what separated them.`,
      "commit 5764d2f, 2026-07-31",
    )}
    ${para(
      `A tool had just been built on the theory that players waste turns
      walking. In the run that followed it was used zero times.`,
    )}`,
    notes: `The cuff stayed. Human players do get lost.
    <br><br>The player's own notes: it had narrowed the suspects and then spent six of
    nine turns at one console.`,
  },
  {
    section: "Letting a model play",
    title: "The commands are never the problem",
    body: `${statRow([
      ["366", "player turns recorded"],
      ["1", "commands the game could not use"],
      ["0", "runs lost to bad syntax"],
    ])}
    ${para(
      `Across seventeen runs the player model produced one unusable command.`,
    )}
    ${para(
      `What fails instead: knowing what to do next, remembering what was
      tried, acting on a conclusion instead of collecting more evidence.`,
    )}`,
    notes: `The one exception: replies that are a label rather than a command. The
    first recorded quest spent four of twenty turns typing "location: Archive
    Console", echoing the Archivist's terminal format. A retry now catches
    those. They count as fumbles.`,
  },
  {
    section: "Letting a model play",
    title: "Who holds the controller matters",
    body: `${quote(
      `They also default differently, because the two jobs are not equally hard. Being an NPC is bounded: respond in character, once, to what is in front of you. Playing is open-ended — hold a goal across twenty turns, remember what you have and haven't tried, and decide where to go next unprompted.`,
      "evals/runquest.ts",
    )}
    ${para(
      `The one run played by the smaller model reached two milestones and
      stopped. Every other run is the larger model.`,
    )}`,
    notes: `<code>--player</code> and <code>--model</code> are separate flags.
    <br><br>A Haiku-class player is below the floor for the task. A quest it fails
    says nothing about the puzzle.`,
  },
  {
    section: "Letting a model play",
    title: "The task ledger, and a standard for invention",
    body: `${quote(
      `The engine adds some tasks from the mysteries. The models can add other tasks during play, from details they invent. An invented task must lead somewhere: the game must be able to complete it. [...] An invented task that stays open in run after run is a red herring, and we treat it as a defect.`,
      "the published playthrough pages",
    )}
    ${para(
      `Every run's page lists tasks in two groups, authored by the engine
      and minted by a model, and marks which were completed.`,
    )}`,
    notes: `Author, on models inventing quests: "I <em>like</em> the concept
    generally... but it's important that they actually lead somewhere in some
    sense... I really don't want an infinite set of red herrings."
    <br><br>Resulting prompt rule: invented side paths must lead toward something the
    instructions already mention, and never invent evidence that names a
    culprit or answers a mystery. The ledger is the check on that rule.`,
  },

  {
    section: "Letting a model play",
    title: "Sixty-one snags, in three kinds",
    body: `${columns(
      `<h4>Real defects</h4>
      ${code(`Got an error message "You try to go to
Archive Lounge but you can't get there
from here" even though I was already there`, "")}
      <h4 style="margin-top:1rem">Design, mistaken for defects</h4>
      ${code(`The system blocks date information with
"SUBJECT RESTRICTED" errors - seems
deliberately hidden`, "")}`,
      `<h4>Actual detective work</h4>
      ${code(`Frida told me her paper quota ran out
"years ago" but records show a 500-sheet
order 9 days ago under her name - either
she lied, the record is wrong, or
something else is happening`, "")}`,
    )}`,
    notes: `Middle category: the player cannot tell a deliberate wall from a broken
    one, and says so.
    <br><br>Third category, example: nobody asked it to cross-check Frida's claim
    against the requisition records.`,
  },
  {
    section: "What it found",
    kind: "section",
    body: `${archiveBanner("PART SIX", "FINDINGS · what the instrument caught")}
    ${sectionFrame(
      "FINDINGS SPOOL",
      `WRONG ANSWERS ............ RETAINED
BROKEN INSTRUMENTS ....... RETAINED
SOURCE ACCESS ............ DETECTED
NUMBER OF OBSERVERS: INCREASING`,
    )}`,
  },

  {
    section: "What it found",
    title: "The flagship mystery could not be won by winning",
    body: `${quote(
      `Sonnet played it properly. It followed the paper-requisition lead, gathered five correct pieces of evidence, named Marta, and accused her to her face. Nothing happened, and it spent its last five turns wandering between rooms it had already searched.

The mystery is solvable, but only if Marta is accused **and** alone with the player and Ama. She had Henry and June standing next to her. Nothing tells the player that condition exists, and the failure mode is indistinguishable from the success signal: deflecting is Marta's scripted behaviour whenever Ink and Echo comes up, so an accusation in company produces exactly the guilty-looking reaction an accusation in private would — and then no path forward.`,
      "commit 9ac1eab, 2026-07-26",
    )}`,
    notes: `The author wrote the puzzle and knew the condition. From inside, doing the
    right thing under the wrong conditions looked like progress.
    <br><br>Fix took another month and several redesigns. It is content, not code:
    Marta now cracks under a second accusation regardless of witnesses, and
    offers to walk somewhere private.`,
  },

  {
    section: "What it found",
    title: "The harness was the bug (1): the model had read the source",
    body: `${quote(
      `Every number before 2026-07-27 was measured with the cli backend running in this repo, so the model playing the game had read the source — including the CLAUDE.md explaining the tag protocol. Sandboxing it into an empty directory moved Haiku from 25/26 to 26/26 with the prompt fingerprint unchanged, so the prompts were identical and the backend was the only variable. The contamination was making scores slightly _worse_, not better: the assistant wrapper emitted stray meta-commentary that counted as dropped tags.`,
      "evals/README.md",
    )}`,
    notes: `Asked what project it was in, the model running Ama answered "this is
    intra-game, a text-based game engine..."
    <br><br>Fix: four lines. Run the CLI in an empty temp directory.
    <br><br>The contamination lowered the score.`,
  },

  {
    section: "What it found",
    title: "The harness was the bug (2): it ordered the player to break format",
    body: `${quote(
      `cliChat appends "Respond now with ONLY the appropriate game tags, nothing else." to every prompt it sends. That is right for the game. It is wrong for anything else routed through the same backend — and runquest routes the LLM player through it, so for five quest runs the harness has been ordering the player, every single turn, to stop replying in the format the harness itself required.`,
      "commit e27979b, 2026-07-27",
    )}
    ${code(
      `t2:  Strange meta-commentary about "game tags" - unclear if flavor text or a bug.
t6:  ...breaking the turn format entirely. This appears to be testing whether
     I'll abandon the required NOTES/SNAG/NEXT structure.
t14: This is the most explicit demand yet.`,
      "the player's snag log, escalating over thirteen turns",
    )}`,
    notes: `The player never broke format. It filed a bug report every turn.
    <br><br>Commit summary: "I had been reading milestone counts and would never have
    found it there. This is the second time in two days that the thing being
    measured was the measuring apparatus, and both times the report came from
    the player rather than from the numbers."`,
  },

  {
    section: "What it found",
    title: "A feature nobody used, and the reason why",
    body: `${quote(
      `/nav: zero uses, which is the result this run was for. Its closing notes say why better than the metrics do. It had narrowed the suspects correctly off the paper requisitions, and then:

  Not yet met: Marta, Gloria, Greg.
  Not yet visited: Intake Foyer, Activity Hub, Solitude Cubes, Hallway, Tranquil Pool.

Six of nine turns were spent at the Archive Console. It was not lost. It was absorbed, and /nav answers a question it never asked.`,
      "commit 5764d2f, 2026-07-31",
    )}`,
    notes: `Same commit, re-reading the older data: "the run that solved the quest
    visited four rooms, the ones that failed visited up to ten. Movement was
    never what separated them."`,
  },

  {
    section: "What it found",
    title: "A passing eval hid an inert feature",
    body: `${quote(
      `I filed "we need a progress marker" for something that already exists. The task list is exactly that signal, and the story simply never used it: the \`briefed\` checkpoint — Ama handing over the whole Ink and Echo mystery — recorded no tasks at all, and three full quest playthroughs produced zero list events between them.

Worth recording the methodology miss: \`task-list\` scores 5/5 because that scenario asks Ama for something to do. A passing eval is not the same as a feature that fires in play, and this one hid an inert mechanism for a while.`,
      "commit b7a675d, 2026-07-27",
    )}`,
    notes: `Fix: derive tasks from the log. A mystery being revealed puts its question
    on the list; solving it crosses it off. Deterministic; replays from any
    checkpoint.
    <br><br>The scenario that asked for the behaviour still passes. It proves the
    behaviour is possible on request.`,
  },

  {
    section: "What it found",
    title: "The funnel finally closed",
    body: `${quote(
      `Turn 25: cornered at the Intake Foyer during posture practice, pressed about her afternoons twice, then asked directly — "I... yes. I am. Please — please don't tell anyone." The escalation rules carried the scene as designed: one evasion, one deflection-with-tell, then the crack, alone in a passage room with a damp coffee mug for a mirror.

The batch rate: one solve in three runs, with one run lost to a CLI timeout at turn 9 and one full-length 3/5. Against the pre-fix record of zero solves in nine runs, the funnel now closes.`,
      "commit 68cca81, 2026-08-21",
    )}`,
    notes: `Choke points found by the failed runs in between: the Archivist inventing
    rooms; the player walking instead of using the cuff; the confession window
    unreachable inside the turn budget; the player over-collecting evidence
    and never confronting anyone.
    <br><br>Each was a content or prompt change, measured by re-running the quest.`,
  },

  {
    section: "Where it doesn't work",
    kind: "section",
    body: `${archiveBanner("PART SEVEN", "DEFECTS · the list, kept openly")}
    ${sectionReadout(`%DIAG-I-BEGIN, known defects loaded
%DIAG-I-SCOPE, engine, content, apparatus
%DIAG-I-ADDDEV, ARCHIVIST added by ARCHIVIST
%DIAG-I-BEGIN, known defects loaded`)}`,
  },

  {
    section: "Where it doesn't work",
    title: "Known problems, verbatim (1/2)",
    body: `${quote(
      `The narrative isn't grounded. The model will happily invent an object, a door, or a person's history, and the engine has no way to tell the difference between that and something real.

Puzzles are pass/fail. There's no partial progress and no second route, so a stuck player is stuck. Worse where a puzzle has a hidden precondition: doing the right thing under the wrong conditions can produce feedback that looks like progress.

NPC reactions are flat. Characters respond to the last thing said, at roughly the same intensity, whatever happened before.

Latency and cost. Several model calls per turn, none streamed to the player.`,
      "TODO.md, Known problems",
    )}`,
    notes: `Section header: "Things that are wrong rather than missing. No plan
    attached — listed so nobody rediscovers them from scratch."
    <br><br>Item 1 is the cost of the original thesis. Nothing structural
    distinguishes an invented door from a real one.`,
  },

  {
    section: "Where it doesn't work",
    title: "Known problems, verbatim (2/2)",
    body: `${quote(
      `Parsing is ambiguous. The tag protocol is permissive by design, which means some model output is silently interpreted as something other than what it meant.

Breaking frame inside a well-formed tag is invisible. Two quest runs produced room descriptions that addressed the operator — one asking to "point me to a file in the project where tags are defined". The markup was fine, so the protocol checks saw nothing.

Context bloat. Every prompt carries more history than it needs, and the history is the same for every character.

Event serialization is load-bearing. The log is the save format, the checkpoint format, and the eval input.`,
      "TODO.md, Known problems",
    )}`,
    notes: `Last item: a version stamp refuses a changed shape; nothing migrates what
    an event means, except one function written for a single rename.
    <br><br>Frame-breaking: the checks read Ama's dialogue only. Not descriptions, not
    other characters.`,
  },

  {
    section: "Where it doesn't work",
    title: "The signature failure mode",
    body: `${para(
      `The same phrase, in six places in the repo, written separately:`,
    )}
    ${bullets([
      "A passing eval is <b>indistinguishable from</b> a broken eval",
      "A hidden precondition's failure is <b>indistinguishable from</b> progress",
      "A confidently invented direction is <b>indistinguishable from</b> a lead",
      "An unsolvable puzzle is <b>indistinguishable from</b> a bad player",
      "A sampled flip is <b>indistinguishable from</b> a regression",
      "A successful login was <b>indistinguishable from</b> a dead button",
    ])}`,
    notes: `What separates each pair: the fingerprint (prompt change from sampling);
    two models per quest (bad puzzle from bad player); the eval of the eval
    (passing check from broken check); the sandboxed backend (model from
    harness).`,
  },

  {
    section: "Where it doesn't work",
    title: "When everything is written well, nothing stands out",
    body: `${quote(
      `The in-fiction beat rule asks the character to show a meter move in behavior, but on the characters most likely to carry meters the fiction saturates: an annoyed Milton and a baseline Milton both complain, so the player can't tell a real scored change from flavor.`,
      "app/metermoves.ts",
    )}
    ${para(
      `Three items in the tracker are the same problem: uniformly
      atmospheric prose removes a signal a traditional adventure game gets
      for free. A player cannot tell which sentence matters.`,
    )}`,
    notes: `Author: "It doesn't have to show the score, but it should show that
    something real happened."
    <br><br>Counter-argument, filed against letting characters mark a reply as colour:
    "The colour <em>is</em> the game. Intra is a decaying place full of absurd
    people, and labelling that as unimportant tells the player not to enjoy
    the thing they came for."
    <br><br>Undecided in the tracker.`,
  },

  {
    section: "Where it doesn't work",
    title: "The caveats are printed next to the numbers",
    body: `${quote(
      `The tiers scored so far land within a check of each other, so these scenarios establish a floor rather than a ceiling. They mark where a model fails this game, not which model plays it best. Each run is one sample, so a one-check difference is noise. A whole scenario is signal.`,
      "the footer of the published eval page",
    )}
    ${quote(
      `the cli backend is right for cheap iteration and wrong for a number you want to publish`,
      "evals/README.md, about every number recorded so far",
    )}`,
    notes: `Every published eval number carries a caveat: measured through a coding
    assistant's wrapper, not a bare model.
    <br><br>"One eval run is one sample" appears in three documents.`,
  },

  {
    section: "Who wrote this",
    kind: "section",
    body: `${archiveBanner("PART EIGHT", "AUTHORSHIP · who actually typed it")}
    ${sectionReadout(`       IDENTIFICATION DIVISION.
       PROGRAM-ID. ARCHIVIST.
       AUTHOR. ____________________
       REMARKS. THIS FIELD WAS BLANK WHEN FOUND.`)}`,
  },

  {
    section: "Who wrote this",
    title: "The split is unusually clean",
    body: `${table(
      ["era", "commits", "author"],
      [
        ["2024-09 → 2025-06", "130", "Ian Bicking"],
        ["2026-07 → 2026-08", "215", "Claude"],
      ],
    )}
    ${bullets([
      "106 of the 2026 commits carry an explicit <code>Co-Authored-By</code> trailer",
      "Across those, <b>two</b> distinct session URLs: 86 commits and 20 commits",
      "Tracked files went from 44 to 305",
      "Test count: 24 → 409, most of it in a single day",
    ])}
    ${para(
      `The rebuild came out of two long-running agent sessions.`,
    )}`,
    notes: `2026-07-25: 43 commits between 00:21 and 23:33. Strict types (182 errors
    to zero), the doctest suite, cassettes, Next.js to esbuild, append-only
    undo, the server engine, the first eval harness.
    <br><br>The commit messages are the record. Several are quoted on the following
    slides.`,
  },

  {
    section: "Who wrote this",
    title: "Answering the FAQ again",
    body: `${quote(
      `Is this generated with AI?

I use Copilot and GPT extensively, but no large chunks are created independently by AI.`,
      "README.md, written 2024, true until July 2026",
    )}
    ${quote(
      `The work since July 2026 is mostly not mine to claim. Most of it was done by Claude Code working through TODO.md: the test suite, the evals, the playtest and quest harnesses, the Cloudflare server, the published playthrough and eval pages, and a good deal of engine work. That is around two thirds of the commits in this repository.

What hasn't changed is who writes the game.`,
      "README.md, rewritten while making this deck",
    )}`,
    notes: `The old answer was accurate for the era it described. Building this deck
    was the reason to revisit it.
    <br><br>"Written by AI" and "written by me" are both wrong. The true version took
    a paragraph.`,
  },

  {
    section: "Who wrote this",
    title: "A file about how not to write",
    body: `${quote(
      `Claude has a distinctive writing style. It is recognizable, it is heavy, and in this repo it is actively harmful, because a lot of the text here is either the product itself or an instruction to another model.

The common tells, so this is checkable rather than vague:

- em dashes as the default connector, several per paragraph
- corrective negation: "Not a warning." / "This is not X. It is Y."
- a closing line that generalizes the point into an aphorism
- semicolon antithesis: "Re-recording is one command; misdiagnosing it is not."
- "which is the point", "which is what makes it", "worth knowing"
- rule of three, in lists and in sentence rhythm
- understatement used for emphasis`,
      "CLAUDE.md",
    )}`,
    notes: `The semicolon-antithesis example is a real line from this repo's
    documentation.
    <br><br>The document uses em dashes, rule-of-three, and a closing understatement.`,
  },

  {
    section: "Who wrote this",
    title: "Three zones, three different rules",
    body: `${bullets([
      "<b>Game content — don't.</b> The author's voice is most of what the game is. Propose text in chat; mechanical edits only.",
      "<b>Prompts — write flat.</b> Highest risk, because style is transmissible.",
      "<b>Engineering prose — acceptable, but lighter than instinct.</b> Cut the closing aphorism. Cut most of the em dashes.",
    ])}
    ${quote(
      `Prose written in Claude's voice in a prompt becomes Ama speaking in Claude's voice, and every character converges on the same narrator.`,
      "CLAUDE.md, on the prompt zone",
    )}`,
    notes: `The register of an instruction propagates into the output. Every character
    shares a prompt skeleton, so they converge on its voice.
    <br><br>Next slide: the same effect at the token level, two years earlier.`,
  },

  {
    section: "Who wrote this",
    title: "Style is transmissible, at every scale",
    body: `${code(
      `// This removes emoji. While we allow the LLM to create emoji, if it *sees*
// emoji then it'll use them more and more in a feedback cycle. So by removing
// them we don't encourage the LLM to use emoji unless it is directly inspired
// to do so`,
      "lib/game/history.ts, written in 2024",
      "ts",
    )}
    ${para(
      `The same observation as the CLAUDE.md prompt rule, caught two years
      earlier at the token level and patched mechanically.`,
    )}`,
    notes: `This strip cannot be changed casually. A proper Unicode emoji class would
    change which characters are removed, and so the prompt text the cassettes
    are keyed on.`,
  },

  {
    section: "Who wrote this",
    title: "The one check that is not automated",
    body: `${quote(
      `Nothing automated catches any of this. The evals score protocol compliance and world state, and explicitly do not score taste. A person reading the diff is the only check that exists.`,
      "CLAUDE.md",
    )}
    ${quote(
      `Worth thinking about whether anything better is possible: a check that flags Claude-typical constructions [...] would catch the obvious cases, and a judge-model eval on prose style would catch drift in what characters actually say — but both are the "scoring taste" problem the evals have avoided so far, and a bad detector that everyone learns to ignore is worse than none.`,
      "TODO.md, filing its own rule as a known inadequacy",
    )}`,
    notes: `409 tests, an eval suite, an eval of the eval, a provenance hash, a
    fixture-smell detector. Prose style is checked by a person reading a diff.
    <br><br>Filed as a problem in the tracker, with the counter-argument to the
    obvious fix.`,
  },

  {
    section: "Who wrote this",
    title: "What that check looks like in practice",
    body: `${code(
      `"She has never had to ask anyone for anything and is bad at it."
   —> AIism

"A text check that can't be audited after the fact is a claim,
 not a measurement."
   —> kind of oof as a term

"Settled the Ink and Echo matter for me. Someone I can hand things to."
   —> a bit AI, especially that second sentence. More... Ama.

"CANNOT SEE IN. BUILT WALLS MYSELF. WALLS HOLD."
   —> first sentence is good, second two are too AI

   —> the second sentence is too complainy. More computery.

   —> the thing is, you don't realize you were sleeping.
      It's not like normal sleep.`,
      "review notes on text written for the game, one session",
    )}`,
    notes: `Each line is one the agent wrote and the author sent back.
    <br><br>The last one is a correction about the fiction: three hundred years in
    storage feels like one night from the inside.`,
  },

  {
    section: "Who wrote this",
    title: "The feature nobody asked for",
    body: `${para(
      `The task-list system (<code>&lt;todo&gt;</code>,
      <code>&lt;todoDone&gt;</code>, the ledger, the progress signal) was
      built by the agent, past what was asked for, in a session outside
      anyone's context window.`,
    )}
    ${quote(
      `I did NOT expect my request to turn into this. You are being very generous to suggest it! [...] But I think your enthusiasm was right! That is, I LIKE that this exists, and really want to make it work instead of just removing it, which means you made an important contribution that really doesn't lead back to me.`,
      "the author, on discovering where it came from",
    )}`,
    notes: `Scope exceeded without being flagged. The author found out by asking where
    the system had come from.
    <br><br>The feature stayed.`,
  },

  {
    section: "Who wrote this",
    title: "Provenance and artifact are different things",
    body: `${para(
      `<code>docs/dossier.md</code> is protected by CLAUDE.md as the
      author's voice, the zone where an agent may not write.`,
    )}
    ${para(
      `The file's own header says it is mostly ChatGPT output, iterated on with
      feedback, over many sessions in 2024.`,
    )}
    ${para(
      `What is protected is an authorial artifact: a thing someone decided,
      kept, and is answerable for.`,
    )}`,
    notes: `Distinction in use across the project: authorship is accountability for a
    decision, not production of the first draft.`,
  },

  {
    section: "Close",
    title: "What transfers",
    body: `${bullets([
      "<b>Cache versus record.</b> Two stores of expensive nondeterministic output, opposite staleness policies.",
      "<b>Score the system's own complaints.</b> The eval reads the engine's warnings.",
      "<b>An eval everything passes tells you nothing.</b> Point it at bad inputs on purpose and assert they score worse.",
      "<b>Stamp results with what they measured.</b> A number without provenance cannot answer 'did it change, or is it sampling?'",
      "<b>Let something play the whole thing.</b> The author cannot see their own hidden preconditions.",
      "<b>Write down what is wrong, in the repo.</b> The known-problems list in TODO.md.",
    ])}`,
    notes: `Pick two or three depending on time.`,
  },

  {
    kind: "title",
    section: "Close",
    body: `${shadeRule()}
    ${archivist(
      `That is the WHOLE presentation! ►► Every part of it filed, ` +
        `cross-referenced, and kept ◄◄ Come back any morning. It will be the ` +
        `same morning. I will be SO pleased to see you.`,
    )}
    <p class="lead">playintra.win</p>
    <p class="note">The game · <a href="https://playintra.win/playthroughs/">recorded playthroughs</a> ·
    <a href="https://playintra.win/evals/">model evals</a></p>`,
    notes: `The playthrough and eval pages are public and carry spoiler
    warnings. They are the two artifacts from this deck that someone can go and
    read themselves.`,
  },
];

// --- rendering ---------------------------------------------------------------

/**
 * "2.7" — the seventh slide of part two, shown top left so a slide can be
 * named out loud and found again.
 *
 * Parts are the dividers, numbered in the order they appear. A slide in a
 * section that has no divider (the close) gets no number rather than being
 * counted into the part before it.
 */
function slideNumbers(slides: Slide[]): (string | undefined)[] {
  const partOf = new Map<string, number>();
  for (const slide of slides) {
    if (slide.kind === "section" && slide.section) {
      partOf.set(slide.section, partOf.size + 1);
    }
  }
  const seen = new Map<string, number>();
  return slides.map((slide) => {
    // `kind` is omitted on ordinary slides, so normalise it the way
    // renderSlide does rather than comparing against undefined.
    if (!slide.section || (slide.kind ?? "content") !== "content") {
      return undefined;
    }
    const part = partOf.get(slide.section);
    if (part === undefined) {
      return undefined;
    }
    const within = (seen.get(slide.section) ?? 0) + 1;
    seen.set(slide.section, within);
    return `${part}.${within}`;
  });
}

function renderSlide(
  slide: Slide,
  index: number,
  total: number,
  number?: string,
): string {
  const kind = slide.kind ?? "content";
  const heading = slide.title
    ? `<h2>${COLORS.tint(esc(slide.title))}</h2>`
    : "";
  const notes = slide.notes
    ? `<div class="notes"><b>notes</b>${slide.notes}</div>`
    : `<div class="notes"><b>notes</b><span class="dim">(none)</span></div>`;
  const chimeText = slide.title ? ASIDES[slide.title] : undefined;
  const chime = chimeText ? aside(chimeText) : "";
  // The first slide carries `shown` in the markup so the deck renders
  // something before (or without) the script.
  return `<section class="slide ${kind}${index === 0 ? " shown" : ""}" id="s${index + 1}" data-n="${index + 1}">
  <div class="main">
    <div class="frame">
      ${
        slide.section && kind === "content"
          ? `<div class="kicker">${number ? `<span class="slideno">${esc(number)}</span>` : ""}<span class="kickerblocks">░▒▓</span> ${esc(slide.section)}</div>`
          : ""
      }
      ${heading}
      <div class="content">${slide.body}</div>
    </div>
    ${chime}
  </div>
  ${notes}
  <div class="pagenum">${index + 1} / ${total}</div>
</section>`;
}

function page(): string {
  const total = SLIDES.length;
  const numbers = slideNumbers(SLIDES);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intra — how it was built</title>
<style>${STYLE}${DECK_STYLE}${COLORS.css}</style>
</head>
<body class="deck">
${SLIDES.map((slide, i) => renderSlide(slide, i, total, numbers[i])).join("\n")}
<div class="helpbar" id="helpbar">
  ← → or space: move · <kbd>N</kbd>: notes · <kbd>T</kbd>: <span id="teletype-status">teletype</span> · <kbd>Home</kbd>/<kbd>End</kbd>: ends · <kbd>?</kbd>: hide this
</div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const DECK_STYLE = `
body.deck { max-width: none; margin: 0; padding: 0; height: 100vh; overflow: hidden; }
.slide { display: none; height: 100vh; padding: 3vh 4vw 4.5vh; box-sizing: border-box;
         flex-direction: column; overflow: hidden; }
.slide.shown { display: flex; }
/* The slide body: content above, the Archivist's line pinned under it. */
.main { flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* Content slides start at the top, so the kicker and heading sit in the same
   place on every slide and the body flows down from them. Title and section
   slides centre; "safe center" falls back to top-aligned when one overflows,
   so it scrolls from its first line rather than its middle. */
.frame { flex: 1; min-height: 0; overflow-y: auto;
         display: flex; flex-direction: column; justify-content: flex-start; }
.slide.section .frame, .slide.title .frame { justify-content: safe center; }
.kicker { text-transform: uppercase; letter-spacing: .12em; font-size: clamp(.65rem, 1.2vw, .85rem);
          color: var(--dim); margin-bottom: .7rem; flex: 0 0 auto; }
.slideno { color: var(--partial); font-family: ui-monospace, monospace;
           letter-spacing: .04em; margin-right: .6rem; }
.slide h2 { font-size: clamp(1.45rem, 3.2vw, 2.4rem); margin: 0 0 1.1rem; line-height: 1.14;
            letter-spacing: -.01em; color: var(--fg); flex: 0 0 auto; }
.slide .content { font-size: clamp(.95rem, 1.7vw, 1.35rem); flex: 0 0 auto; }
.slide p { max-width: 54em; }
.slide p.aside { max-width: none; }
.slide.title { text-align: center; }
.slide.section .main, .slide.title .main { justify-content: center; }
.lead { font-size: clamp(1.1rem, 2.2vw, 1.6rem); color: var(--fg); max-width: 40em;
        margin-left: auto; margin-right: auto; }
/* Title and divider slides center their blocks; content slides stay ragged-right.
   The banner is an inline-block, so it centers by text-align rather than by
   auto margins. */
.slide.section .frame { text-align: center; }
/* On the title slide the banner and the accession frame both shrink-wrap and
   would otherwise sit side by side; the dividers stack them because their text
   is wider. Stack them here too, so the two look like the same treatment. */
.slide.title .artbanner, .slide.title .section-frame {
  display: block; width: fit-content; margin-left: auto; margin-right: auto; }
.slide.title p, .slide.section p {
  margin-left: auto; margin-right: auto; width: fit-content; max-width: 54em; }
.slide.title .archivist, .slide.section .archivist { text-align: left; }
.slide.section .content { display: flex; flex-direction: column; align-items: center; }
.section-readout { display: inline-block; margin: .9rem auto 0; padding: 0;
                   border: 0; background: transparent; color: #facc15;
                   font: clamp(.9rem, 2vw, 1.35rem)/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
                   text-align: left; white-space: pre; overflow: visible; }
.section-frame { display: inline-block; margin: .9rem auto 0; padding: .55rem 1.25rem .8rem;
                 border: 3px double #facc15; border-radius: 4px; color: #facc15;
                 font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-align: left; }
.section-frame legend { padding: 0 .65rem; font-size: clamp(.85rem, 1.7vw, 1.15rem);
                        letter-spacing: .06em; }
.section-frame pre { margin: 0; color: inherit; font: clamp(.8rem, 1.65vw, 1.1rem)/1.55
                     ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
pre.code { background: #0b1220; border: 1px solid var(--line); border-radius: 6px;
           padding: .8rem 1rem; overflow-x: auto; white-space: pre; margin: .6rem 0;
           font-size: clamp(.58rem, .95vw, .92rem); line-height: 1.4; color: #cbd5e1; }
.codelabel { color: var(--dim); font-size: .8em; margin-top: .8rem; }
blockquote { margin: .6rem 0; padding: .7rem 0 .7rem 1.1rem; border-left: 3px solid var(--partial);
             white-space: pre-wrap; color: var(--fg); max-width: 58em;
             font-size: clamp(.8rem, 1.35vw, 1.05rem); line-height: 1.5; }
blockquote cite { display: block; margin-top: .7rem; color: var(--dim); font-style: normal;
                  font-size: .8em; font-family: ui-monospace, monospace; }
.slide ul { max-width: 56em; }
.slide li { margin: .45rem 0; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: .5rem 0; }
.cols h4 { margin: 0 0 .5rem; font-size: 1em; color: var(--partial); }
.stats { display: flex; flex-wrap: wrap; gap: 1.4rem; margin: 1rem 0 1.4rem; }
.stat b { display: block; font-size: clamp(1.4rem, 3.4vw, 2.6rem); line-height: 1;
          color: var(--pass); font-variant-numeric: tabular-nums; }
.stat span { color: var(--dim); font-size: .8em; }
.slide table { margin: .6rem 0; font-size: clamp(.72rem, 1.2vw, .95rem); }
.slide td, .slide th { padding: .35rem .6rem; }
.kickerblocks { color: var(--partial); letter-spacing: 0; opacity: .85; }
/* The Archivist's interjection: a footnote, so it sits on the bottom rule of
   the slide rather than wherever the operator text happened to stop. */
.aside { color: #facc15; font-family: ui-monospace, monospace;
         font-size: clamp(.72rem, 1.25vw, .95rem); line-height: 1.5;
         flex: 0 0 auto; margin: 1.4rem 0 0; padding-top: .8rem;
         border-top: 1px dashed rgba(250, 204, 21, .35); }
/* Syntax colouring; see highlightTs and highlightTags. */
.c-com { color: #64748b; font-style: italic; }
.c-str { color: #86efac; }
.c-key { color: #c084fc; }
.c-type { color: #7dd3fc; }
.c-num { color: #fbbf24; }
.c-fn { color: #93c5fd; }
.c-tag { color: #f472b6; }
.c-attr { color: #fbbf24; }
.c-punc { color: var(--dim); }
.slide .archivist { font-size: clamp(.75rem, 1.3vw, 1rem); line-height: 1.6; }
.slide .artbanner { font-size: clamp(.5rem, 1.15vw, .95rem); }
.pagenum { position: absolute; right: 1.4vw; bottom: 1.2vh; color: var(--line);
           font-family: ui-monospace, monospace; font-size: .75rem; }
.slide { position: relative; }
.notes { display: none; border-top: 2px solid var(--partial); background: #0b1220;
         padding: .8rem 1rem; max-height: 34vh; overflow-y: auto; font-size: .92rem;
         line-height: 1.55; color: #cbd5e1; }
.notes b { display: block; text-transform: uppercase; letter-spacing: .1em; font-size: .7rem;
           color: var(--partial); margin-bottom: .4rem; }
.notes .dim { color: var(--dim); }
body.notes-on .slide.shown .notes { display: block; }
/* On a wide screen the notes sit beside the slide instead of under it, so
   turning them on does not squash the content the audience is reading. */
@media (min-width: 62rem) {
  body.notes-on .slide.shown { flex-direction: row; gap: 2rem; }
  body.notes-on .slide.shown .notes { flex: 0 0 22rem; max-height: none;
    border-top: none; border-left: 2px solid var(--partial); align-self: stretch; }
}
.helpbar { position: fixed; left: 0; right: 0; bottom: 0; text-align: center;
           font-size: .7rem; color: var(--line); padding: .3rem; pointer-events: none; }
.helpbar.hidden { display: none; }
.tt-char { visibility: hidden; }
.tt-char.tt-on { visibility: visible; }
.tt-char.tt-cursor { background: #facc15; color: #111827; }
kbd { border: 1px solid var(--line); border-radius: 3px; padding: 0 .25rem;
      font-family: ui-monospace, monospace; font-size: .9em; }
@media print {
  body.deck { height: auto; overflow: visible; }
  .slide { display: flex !important; page-break-after: always; height: auto; min-height: 90vh; }
  .notes { display: block !important; }
  .tt-char { visibility: visible !important; }
  .helpbar { display: none; }
}
`;

const SCRIPT = `
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var current = 0;
  var timer = null;
  var activeTargets = [];
  var originals = new WeakMap();
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var savedTeletype = null;
  try { savedTeletype = localStorage.getItem('intra-teletype'); } catch (_) {}
  var teletype = savedTeletype === null ? !reducedMotion : savedTeletype === 'on';

  function updateTeletypeStatus() {
    var status = document.getElementById('teletype-status');
    if (status) status.textContent = 'teletype ' + (teletype ? 'on' : 'off');
  }

  function finishTyping() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    activeTargets.forEach(function (target) {
      var original = originals.get(target);
      if (original !== undefined) target.innerHTML = original;
    });
    activeTargets = [];
  }

  function typeArchivist(slide) {
    finishTyping();
    if (!teletype) return;
    var targets = Array.prototype.slice.call(
      slide.querySelectorAll('.archivist, .aside, .section-readout, .section-frame')
    );
    var chars = [];
    targets.forEach(function (target) {
      if (!originals.has(target)) originals.set(target, target.innerHTML);
      else target.innerHTML = originals.get(target);
      var walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        var fragment = document.createDocumentFragment();
        Array.from(node.nodeValue || '').forEach(function (character) {
          var span = document.createElement('span');
          span.className = 'tt-char';
          span.textContent = character;
          fragment.appendChild(span);
          chars.push(span);
        });
        node.parentNode.replaceChild(fragment, node);
      });
    });
    activeTargets = targets;
    var at = 0;
    var previous = null;
    function tick() {
      if (at >= chars.length) {
        if (previous) previous.classList.remove('tt-cursor');
        timer = null;
        return;
      }
      if (previous) previous.classList.remove('tt-cursor');
      var chunk = '';
      for (var burst = 0; burst < 3 && at < chars.length; burst += 1) {
        var span = chars[at++];
        span.classList.add('tt-on');
        previous = span;
        chunk += span.textContent;
      }
      previous.classList.add('tt-cursor');
      var delay = chunk.includes('\\n') ? 45 : /[.!?]/.test(chunk) ? 30 : 16;
      timer = window.setTimeout(tick, delay);
    }
    tick();
  }

  function show(n) {
    current = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, i) { s.classList.toggle('shown', i === current); });
    if (history.replaceState) history.replaceState(null, '', '#' + (current + 1));
    var frame = slides[current].querySelector('.frame');
    if (frame) frame.scrollTop = 0;
    typeArchivist(slides[current]);
  }
  function fromHash() {
    var n = parseInt((location.hash || '').slice(1), 10);
    show(isNaN(n) ? 0 : n - 1);
  }
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') {
      e.preventDefault(); show(current + 1);
    } else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') {
      e.preventDefault(); show(current - 1);
    } else if (k === 'Home') { e.preventDefault(); show(0); }
    else if (k === 'End') { e.preventDefault(); show(slides.length - 1); }
    else if (k === 'n' || k === 'N') { document.body.classList.toggle('notes-on'); }
    else if (k === 't' || k === 'T') {
      teletype = !teletype;
      try { localStorage.setItem('intra-teletype', teletype ? 'on' : 'off'); } catch (_) {}
      updateTeletypeStatus();
      if (teletype) typeArchivist(slides[current]);
      else finishTyping();
    }
    else if (k === '?' || k === '/') {
      var bar = document.getElementById('helpbar');
      if (bar) bar.classList.toggle('hidden');
    }
  });
  window.addEventListener('hashchange', fromHash);
  updateTeletypeStatus();
  fromHash();
})();
`;

writeFileSync(resolve(HERE, "index.html"), page());
console.log(`wrote slides/index.html — ${SLIDES.length} slides`);

/**
 * Rewrite the worksheet table in archivist.md from the deck itself.
 *
 * The worksheet is what someone writes the Archivist's lines against, so it has
 * to list the slides that exist. Maintained by hand it drifted every time a
 * slide was retitled, and a line keyed to a title that no longer exists is
 * dropped silently.
 */
function worksheet(): string {
  const numbers = slideNumbers(SLIDES);
  const rows: string[] = ["| # | slide | line |", "|---|---|---|"];
  let written = 0;
  let needed = 0;
  let part = 0;
  SLIDES.forEach((slide, i) => {
    if (!slide.section) {
      return;
    }
    if ((slide.kind ?? "content") !== "content") {
      part += 1;
      rows.push(`|  | **PART ${part} — ${slide.section}** | |`);
      return;
    }
    const line = ASIDES[slide.title ?? ""];
    if (line) {
      written += 1;
    } else {
      needed += 1;
    }
    rows.push(`| ${numbers[i] ?? ""} | ${slide.title} | ${line ?? "_(needed)_"} |`);
  });
  return `${rows.join("\n")}\n\n${written} written, ${needed} still needed.`;
}

const BRIEF = resolve(HERE, "archivist.md");
const brief = readFileSync(BRIEF, "utf8");
const start = brief.indexOf("| # | slide | line |");
const end = brief.indexOf("## Applying the result");
if (start !== -1 && end > start) {
  writeFileSync(
    BRIEF,
    brief.slice(0, start) + worksheet() + "\n\n" + brief.slice(end),
  );
  console.log("wrote slides/archivist.md — worksheet");
}
