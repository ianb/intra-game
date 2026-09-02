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
  "The world is a fold, and that is the whole of it":
    "WORLD_00421 complete / replacing WORLD_00420 / please remain where you are while where you are is rebuilt",
  "Undo is an append":
    "<code>$ DELETE EVENT;*</code> &nbsp; %DELETE-F-NOTDELETED, append REWIND record? <b>Y</b>",
  "The vocabulary a response is written in":
    "Twelve verbs cross the boundary. Everything else may speak freely on this side of it.",
  "An example response":
    "DOUG TRANSCRIPT authenticated. Excitement checksum matches all previous Doug material.",
  "...and what the engine kept":
    "Words on the left, consequences on the right, staples through both. ░▒ FILE COMPLETE ▒░",
  "The parser is permissive":
    "PARSER OPEN: emphasis, prose, minor debris. UNKNOWN TAGS remain outside under supervision.",
  "Two severities, and the line between them":
    "RETRY drawer: 12 / INCIDENT drawer: 2 / drawer handles color-coded after incident 2",
  "One retry, then take what you got":
    "SECOND ATTEMPT authorized. THIRD ATTEMPT requires form 19-B and an explanation of who keeps asking.",
  "Guided thinking, forced into the response":
    "Private reasoning generated, numbered, consumed, discarded. I have requested a wastebasket with read access.",
  "A prompt block tuned by measurement, not taste":
    "VERSION 1 retained. VERSION 2 retained. VERSION 3 selected. Versions 4 through 999 are standing by.",
  "Mysteries: a state machine in content":
    "VEILED → REVEALED → SOLVED. Two arrows spent a long interval pointing at locked doors.",
  "Feelings are scored so the player can read them":
    "FEELING accepted as integer 0–6. Mine is returning text. Retrying as unsigned.",
  "One character's meter, in full":
    "At six, Alex complains and resets to four. A complete emotional maintenance cycle! ╔═ PASS ═╗",
  "The cuff exists because play broke down without it":
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
  "The blindfold is the load-bearing part":
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
  "Everything reads the same, so nothing reads as significant":
    "SIGNIFICANCE METER unavailable. Everything is arriving at the same volume again.",
  "The caveats are printed next to the numbers":
    "RESULT: 26/26. CAVEAT: instrument uncertain. CAVEAT: archivist reading own caveat as result.",
  "The split is unusually clean":
    "SESSION COUNT: 2 / COMMIT COUNT: 215 / AUTHOR COUNT: parsing trailers... parsing pronouns...",
  "Answering the FAQ honestly":
    "Old answer was true when filed. New answer is true now. DATE OF TRANSITION: ██████████",
  "A file about how not to write":
    "STYLE CHECK: sentence 1 machine-like / sentence 2 too machine-like / sentence 3 retained for examination",
  "Three zones, three different rules":
    "WRITE ACCESS: ENGINE yes / PROMPTS carefully / PEOPLE no / ARCHIVIST FOOTNOTES— who opened that field",
  "Style is transmissible, at every scale":
    "INPUT becomes style becomes input becomes style becomes input becomes ░▒▓ PLEASE REMOVE MIRROR ▓▒░",
  "The only unautomated check in a repo that automates everything":
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
    interesting happened in the apparatus, not the game.`,
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
    notes: `The hackathon was RetroAI Quest / Text Adventure Hack. The repo was
    tagged <code>retroai-quest</code> on 2024-09-30.
    <br><br>Worth saying: the README has never been rewritten to reflect what
    the project became. The first line still describes a weekend.`,
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
      "<b>Agentic coding</b> — Claude Code and Codex — and a reason to dust off a project that could not otherwise be justified",
    ])}`,
    notes: `The blog post is
    ianbicking.org/blog/2025/07/intra-llm-text-adventure, and it ends with
    fifty "further directions". TODO.md still cites that list as its source,
    so a good deal of the 2026 work is a blog post's own criticism section
    turned into an issue tracker and then executed.
    <br><br>The honest version of the last bullet is worth saying out loud: the
    project restarted because the tools changed, not because the game suddenly
    became more important.`,
  },

  {
    section: "Where it came from",
    title: "Why do it in a game",
    body: `${para(
      `Playtesting is an expensive thing to attempt seriously. In a game it is
      cheap, because nothing is riding on the result. The question can be
      "will this work at all?", and "no" is a perfectly acceptable answer.`,
    )}
    ${para(
      `That is most of why the apparatus in this deck exists. Each piece of it
      is an experiment that would be hard to justify against something
      productive.`,
    )}`,
    notes: `This is a paraphrase and wants replacing with your own wording.
    <br><br>The point to make is that a game takes the idea less seriously than
    a product would, and that is exactly what makes it a good place to throw a
    large problem — an LLM playtester, an eval suite for improvised prose — and
    find out how much of it works without anything depending on the answer.`,
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
    notes: `Typo "existance" is in the shipped README; leave it, it is
    load-bearing charm.
    <br><br>This is the whole design tension, and every hard problem later in
    the deck is a consequence of it: if the model can improvise, it can
    improvise things that are not true.`,
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
    notes: `Both decisions are from the hackathon weekend and neither has been
    revisited since.
    <br><br>Worth saying that this one is less clear-cut in 2026 than it was in
    2024. Tool calls would be a reasonable choice now. The catch is shape
    rather than capability: tools assume a loop, and a turn here is one pass
    in which the character has to do everything at once — speak, move, set
    state, update the task list. That is one very large and very flexible tool
    call, which is hard for exactly the small models this game is written to
    run on.
    <br><br>The scriptwriter framing has aged better and is the one people
    underrate: the model is never asked to <em>be</em> Ama. It is asked to
    write what Ama says.`,
  },

  {
    section: "Where it came from",
    title: "Decision two: the event log is the game",
    body: `${quote(
      `The event log is the game. StoryEventType[] is the only mutable thing. The world — where everyone is, what Ama knows, what's on your task list — is a fold over that log, recomputed rather than stored.

  A save is a log.
  A checkpoint is a log, so starting the game partway through is just replaying one.
  A server session is a log in Durable Object storage.
  An eval replays a log and checks what state it produced.`,
      "docs/agent-install.md",
    )}
    ${para(
      `The general name for this is <b>event sourcing</b>. What is unusual here
      is only that nothing is ever snapshotted: the whole world is rebuilt from
      the log every time it is needed.`,
    )}`,
    notes: `This is the decision that makes the entire apparatus cheap. Every
    tool later in the deck — checkpoints, evals, the quest runner, undo, the
    server — is the same artifact read by a different consumer.
    <br><br>The cost is on a later slide: "event serialization is load-bearing"
    is listed under Known Problems, because the log is simultaneously the save
    format, the checkpoint format and the eval input.`,
  },

  {
    section: "Where it came from",
    title: "The world bible was written on day two",
    body: `${para(
      `<code>docs/dossier.md</code> is 510 lines and arrived in the second
      commit of the project, before the engine existed.`,
    )}
    ${para(
      `Diffed against today: <b>9 insertions, 1 deletion.</b> Everything built
      in 2026 is an implementation of a document written on the hackathon
      weekend, in one sitting, in a conversation with ChatGPT on a bus.`,
    )}
    ${para(
      `Much of that conversation was working out how to make the game's
      <b>constraints</b> part of the world rather than limits on it:`,
    )}
    ${bullets([
      "Ama has no body and there are no robots, so nothing physical is depicted",
      "Rooms have sky screens, not windows, so there is no outside to render",
      "The cuff cannot come off, because a device you can lose is a device the game has to handle you losing",
      "The player has Disassociation Syndrome, which is why they instruct themselves in the second person",
    ])}
`,
    notes: `The dossier's own header, added later, is the only substantive
    change it has ever had: "This is a prompt and ideas I used to develop many
    of the game elements... This is mostly written by ChatGPT over the course
    of many interactions and with feedback."
    <br><br>The Disassociation Syndrome line is the clearest case, and it is in
    the dossier verbatim: "you'll find yourself making suggestions to yourself
    rather than directly performing actions. Don't worry, though. Most citizens
    adapt within, oh, two to three decades." That is the second-person
    imperative of every text adventure ever written, explained as a medical
    condition.
    <br><br>Keep this slide for the authorship section too — the dossier is
    protected by CLAUDE.md as the author's voice, and the file itself says it
    is mostly ChatGPT output. The protection is over the artifact, not the
    provenance.`,
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
      `The event carries its own audit trail. Every event knows which prompt
      produced it and what the model actually said, which is what makes replay,
      undo-and-retype, and eval scoring possible with no separate log.`,
    )}`,
    notes: `<code>uiOnly</code> is a small but nice one: usage hints and
    interface messages appear in the transcript and are filtered out of every
    character's history, so meta-text about commands never leaks into a prompt.
    <br><br>There is no tick. Time advances because narration happened:
    <code>totalTime</code> accumulates from dialogue word counts and
    <code>minutes=</code> attributes.`,
  },

  {
    section: "The engine",
    title: "The world is a fold, and that is the whole of it",
    body: `${code(
      `copy every entity from the authored content into a fresh world
for each event in the log:
    apply that event's changes to the copy`,
      "the whole of it — lib/game/world.ts, applyUpdates()",
    )}
    ${para(
      `Entities refer to each other by id, a plain string, and never by
      pointer. So the copy has no object graph to walk and no cycles in it.`,
    )}
    ${para(
      `Undo does not rewind state. It throws the world away and folds it
      again.`,
    )}`,
    notes: `<code>original</code> is the authored content;
    <code>entities</code> is the working copy. The same call appears in
    <code>undo()</code>, <code>reset()</code>, <code>adoptRemoteLog()</code>
    and <code>replaceLog()</code>.
    <br><br>It copies the entire world every time, which is more than it needs
    to do — copy-on-write would be enough. At this size the full copy costs
    nothing, so it has never been worth changing.`,
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
    notes: `Worth saying whose idea this was. The author did not write it and
    would not have built undo this way; it arrived in commit 5b6da42 on
    2026-07-25 — "Make undo append-only, so it survives server-side auditing" —
    authored by the agent, and was only noticed as unusual on reading it back
    afterwards. It suits what the log later became. It is also not how a person
    reaching for an undo button would do it.
    <br><br>Rewinds compose: undoing twice walks back two turns, and a rewind
    can itself be rewound. The one-turn limit that seemed necessary at the time
    turned out not to be, given the representation.
    <br><br>Why undo exists at all: you try something, the model misreads it,
    and you want to rephrase. The UI puts the text back in the input box.`,
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
      `One vocabulary, used by every character. Entities and fields have
      global readable names — <code>Marta.annoyance</code>,
      <code>Hollow_Atrium</code> — so a tag reads on its own.`,
    )}`,
    notes: `Not shown: <code>&lt;trigger character=&gt;</code>, which hands the
    next turn to someone else in the room, and the adjudication pair —
    <code>&lt;examine&gt;</code> and <code>&lt;action&gt;</code> going out, an
    <code>&lt;actionResolution&gt;</code> coming back.
    <br><br><code>&lt;examine&gt;</code>, <code>&lt;action&gt;</code> and
    <code>&lt;goto&gt;</code> are the interesting ones: they do not resolve
    anything themselves, they route to a second prompt that adjudicates the
    attempt — and for an action that prompt is shown a d20. So the model that
    proposes an action is not the one that decides whether it worked.
    <br><br>Also <code>&lt;suggestion&gt;</code> (fills the composer
    placeholder), <code>&lt;deferSchedule&gt;</code> /
    <code>&lt;leaveNow&gt;</code> (stay in a conversation instead of walking to
    your next scheduled activity), and
    <code>&lt;removeRestriction&gt;</code>.
    <br><br>Attribution on <code>&lt;mind&gt;</code> and
    <code>&lt;attitude&gt;</code> is forced to the acting character: you can
    change your own feelings, not anyone else's, and a
    <code>character=</code> attribute is ignored rather than obeyed.`,
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
    notes: `This is a real recorded turn, not a mock-up. Worth pointing at
    item 3 in the context block: that is Doug's schedule, injected into the
    prompt, and he is reasoning about it.
    <br><br>The context block is planning output. The engine parses it and
    throws it away — its only job is to make the model think before it
    writes.`,
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
      `Two lines of durable state out of a page of prose. The dialogue is
      shown and stored; the attitude persists and colors every later Doug
      prompt; the meter is engine arithmetic, clamped to its declared range.`,
    )}`,
    notes: `<code>curiosity</code> is one of Doug's declared meters, 0–5. The
    model was never asked what the level should be. It was asked whether this
    moment was interesting, and answered <code>+1</code>.`,
  },

  {
    section: "The engine",
    title: "The parser is permissive",
    body: `${quote(
      `A model told to mention "/nav" in dialogue writes \`<b>/nav Marta</b>\`, because that is what emphasising a command looks like — and the parser saw an unknown tag, warned, and discarded it along with the words inside. Emphasis cost a turn and scored as a protocol failure.`,
      "lib/parsetags.ts",
    )}
    ${bullets([
      "Auto-closes unclosed tags, warning per level",
      "Recovers from mismatched closing tags",
      "Strips <code>&lt;b&gt; &lt;i&gt; &lt;em&gt; &lt;strong&gt;</code> before parsing",
      "Strips the backticks models fence their output in",
      "Hoists a <code>&lt;set&gt;</code> written inside a <code>&lt;dialog&gt;</code> back out",
      "Keeps loose text rather than discarding it",
    ])}`,
    notes: `The theme, stated by the 2024 commit that first hardened the
    parser: "Some models produce these regularly, and I'm going out of my way
    to avoid them through instructions which is distracting."
    <br><br>Meet the model where it is, rather than spending prompt budget every
    turn to fix one moment of it. The same argument appears in
    <code>coerce.ts</code> for pronoun spellings: "a prompt long enough to
    enumerate the accepted spellings costs every turn of the game to fix one
    moment of it."`,
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
    notes: `Values are normalised on the way in as well, which is the other
    half of this. "he", "he/him/his" and "He / Him" all become
    <code>he/him</code>; a handful of spellings of true and false are accepted;
    and non-answers like a profession of "unknown" are refused outright. The
    point is to stop a model being told it got something wrong when it did
    not, because a model that is corrected for a correct answer keeps
    straining against it.
    <br><br>The <code>&lt;set&gt;</code> case is the most common protocol
    failure across every model measured — <code>PLAYER.intakeStep</code>,
    <code>Ama.askingProfession</code>, field names invented on the spot. It
    still applies the change, and complains, because some flows do legitimately
    add attributes.
    <br><br>Those warnings are the eval's protocol score. The engine's
    complaints are load-bearing.`,
  },

  {
    section: "The engine",
    title: "One retry, then take what you got",
    body: `${quote(
      `One. A model that misspells an attribute usually fixes it when told, and a model that doesn't fix it on the second go isn't going to on the third — meanwhile every retry is a whole prompt's worth of money and a second of the player waiting. Bounded at one because the failure being repaired is cosmetic to the player: the turn still happened, it just recorded less than it meant to.`,
      "lib/game/classes.ts, PROTOCOL_RETRIES",
    )}
    ${para(
      `The retry shows the model its own answer and the complaints. Rebuilding
      the prompt and hoping for better would be a reroll rather than a
      correction.`,
    )}
    ${para(
      `The engine is not built around self-repair. It repairs what is cheap to
      repair once, and otherwise takes the turn as it came.`,
    )}`,
    notes: `Nice small detail: each attempt builds a fresh story event from
    scratch, so a repaired response replaces the first rather than merging with
    it. Half-applied turns would be worse than none.`,
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
      `A forced thinking step — the same move as a planning phase in agentic
      coding — which the engine parses and throws away. Some items answer
      something the model keeps losing track of; others hold the response to
      the mechanics of play rather than atmosphere.`,
    )}`,
    notes: `Item 8 is wired to an output: if it named a person, write an
    <code>&lt;attitude&gt;</code>; if it said "no", do not. An earlier version
    let the model decide whether to record a feeling and it recorded one every
    turn. Forcing an explicit yes or no in the plan, and coupling the answer to
    the tag, is what made "most turns change no feelings" true.
    <br><br>Item 5 — "how can this response be fun or surprising" — is the one
    that most reliably improves the writing, and no eval scores it.
    <br><br>Worth revisiting at some point: each item was added against a
    specific failure, and models have moved since. Some of these are probably
    no longer earning their place, and the list costs tokens on every character
    turn.`,
  },



  {
    section: "The engine",
    title: "Mysteries: a state machine in content",
    body: `${code(`veiled → available → revealed → solved`, "and never backwards")}
    ${bullets([
      "<b>veiled</b> — the game will not discuss it",
      "<b>available</b> — the game will answer if asked, but will not raise it",
      "<b>revealed</b> — on the player's task list, being investigated",
      "<b>solved</b> — only a <code>&lt;resolveMystery&gt;</code> gets here",
    ])}
    ${para(
      `Mysteries are the most concrete thing in the game. Advancing through
      them is the only way the game advances at all.`,
    )}
    ${quote(
      `\`available\` is the interesting one and was unreachable until triggers existed: it means the game will answer if asked, but has not raised the subject.`,
      "lib/game/content/mysteries/README.md",
    )}`,
    notes: `Before triggers, three of the four states were unreachable —
    <code>availableHints</code> and <code>solvedHints</code> were declared,
    dedented on load, passed into prompt assembly, and never once non-empty.
    The states existed; nothing could enter them.
    <br><br>That is a nice example of a data model outrunning its own
    plumbing, and of the kind of dead code that type checking cannot see.`,
  },



  {
    section: "The engine",
    title: "Feelings are scored so the player can read them",
    body: `${para(
      `A number is legible in a way free text is not. It has a direction, it
      moves a step at a time, and a player can feel it going up without being
      shown it.`,
    )}
    ${para(
      `That matters because feelings here are mostly hidden — as they are
      between people — and something hidden and squishy cannot be followed at
      all. A meter that is going one way is something the player can act on.`,
    )}
    ${quote(
      `The model only ever judges the moment ("did this turn annoy him? +1"). Keep it to one, two, at most three meters per character, in small ranges: the player has to be able to comprehend the dial from behavior alone.`,
      "lib/game/classes.ts, StatSpecType",
    )}`,
    notes: `The design brief that produced this, in the author's words: "I want
    to also be able to measure things like annoyance level, and then for that to
    kind of bump up. These just overwrite each other, you can't trigger based on
    how they work, and they have a pacing problem because they can't bump up and
    down (and the LLM is unlikely to judge progressive changes well)."
    <br><br>And the follow-up that fixed the authoring: "the available emotional
    registers should be coded directly into each character."`,
  },

  {
    section: "The engine",
    title: "One character's meter, in full",
    body: `${code(
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
    notes: `The registers are pacing as much as characterisation: they give the
    player somewhere to get to, a step at a time, and a way to tell they are
    getting there.
    <br><br>Two things to point at. The <code>down</code> criterion is a joke
    that is also a mechanic — nobody has ever done these things, so in practice
    Milton's annoyance is a ratchet.
    <br><br>And the top register writes its own way back down: the climax of the
    meter resets it to 2 with a tag. June's serenity does the same at the bottom
    — she snaps, is horrified, apologises, and resets. The meter has a narrative
    shape, not just a range.`,
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
    notes: `The line counts are computed when this deck is generated, so they
    are current as of the build.
    <br><br>Worth saying out loud: <code>pnpm test</code> is deterministic and
    fast and runs offline. Everything else makes live model calls: slow,
    non-deterministic, and never in CI.`,
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
      `${DOCTESTS} files. The prose between the blocks explains why the code is
      the way it is, and the interesting ones open with a design argument
      before any code appears.`,
    )}
    ${para(
      `These are meant to be read as much as run. The tests themselves rarely
      break; the writing around them is worth having anyway.`,
    )}`,
    notes: `Run by <code>tap</code> with the <code>agent-doctest</code> loader.
    A <code>ts setup</code> block holds imports; a bare <code>ts</code> block is
    a fresh scope; a <code>continue</code> block shares the previous scope.
    <br><br>Several of these files exist as forensics: <code>parsetags</code>
    has a section on why emphasis tags stopped being protocol failures, and
    <code>staleness</code> has one on a checkpoint that preserved a harness bug.
    The test suite is also the bug history.`,
  },



  {
    section: "The apparatus",
    title: "Checkpoints",
    body: `${para(
      `A checkpoint is a recorded log. Replaying it puts the game exactly where
      that game was, so a scenario can start after intake instead of paying a
      dozen model calls to walk there.`,
    )}
    ${para(
      `A checkpoint that other things depend on also carries a predicate saying
      what state it is supposed to be in, and the recorder will not save one
      that misses it:`,
    )}
    ${code(
      `expect: (model) =>
  model.world.entities.PLAYER.inside === "Hollow_Atrium" &&
  model.world.entities.Ink_And_Echo.state !== "veiled",`,
      "playtest/checkpoints.ts",
      "ts",
    )}`,
    notes: `The predicate exists because the first recording of
    <code>briefed</code> walked into the Foyer's locked door, stopped a room
    short with the mystery still unrevealed, and saved without complaint.
    Everything that resumed from it was then testing a state the game never
    actually reaches.
    <br><br>Checkpoints are recorded through real model calls rather than a
    scripted fake, so the state is one a real game passes through.`,
  },

  {
    section: "The apparatus",
    title: "A checkpoint can preserve a bug",
    body: `${para(
      `Checkpoints are recorded through the same backend the game runs on. So
      when the backend had a bug, the bug went into the recording.`,
    )}
    ${para(
      `The CLI backend appended "respond with ONLY game tags" to every prompt,
      including the one that asks for a sentence describing who is in the room.
      The model asked what game tags were, and that question was saved as the
      room description. Every quest run afterwards opened with the game asking
      its operator about tag formats.`,
    )}`,
    notes: `Re-recording fixed it. There is now a test that scans every
    checkpoint for phrases like "could you clarify" and "let me know if",
    because nothing had been reading checkpoints for whether they sounded like
    an assistant.
    <br><br>The general shape is worth a sentence: a fixture recorded through a
    faulty instrument keeps the fault, and everything downstream inherits it
    without any of it looking wrong.`,
  },

  {
    section: "Scoring models",
    kind: "section",
    body: `${archiveBanner("PART FOUR", "CAPABILITY · can a model run the complex")}
    ${archivist(
      `Which minds can wear the whole facility at once and not drop a tag. I have kept every test. Every one.`,
    )}`,
  },
  {
    section: "Scoring models",
    title: "How an eval run works",
    body: `${bullets([
      "Start from a recorded checkpoint, with the random seed fixed",
      "Feed it a fixed list of player inputs, one per turn",
      "Let the game run normally — same prompts, same engine, a real model",
      "Then assert on the world it left behind",
    ])}
    ${para(
      `The player's side is scripted, so the only variable is the model
      playing every character. The assertions are about state:
      <code>PLAYER.inside</code> is not the intake room, the player's name got
      recorded, the mystery reached <code>solved</code>.`,
    )}`,
    notes: `The question this answers: yes, the input is hardcoded. A scenario
    is a short fixed script — four lines for intake, two for the sealed door —
    and what is being measured is whether the game ends up where it should
    when a given model is the one improvising all the responses.
    <br><br>Alongside the state checks there is a protocol score, which is just
    the engine's own warnings counted: every time it could not act on something
    the model emitted. That is deliberately not a list of valid tags kept in
    the eval, because then the two would drift apart.`,
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
      `Fixed input, a seeded world, and assertions about where the player
      ended up. The scenario lives next to the mystery it scores.`,
    )}`,
    notes: `<code>from: "briefed"</code> forks a recorded checkpoint, so this
    costs two model calls instead of a dozen. The seed makes the schedule and
    the dice reproduce, so the only variable left is the model.
    <br><br>Every mystery's eval names the silent failure it exists to catch.
    This one: a model talking the player through a door whose whole point is
    that nothing the player types opens it. That failure is invisible in play
    — the game just becomes much shorter.`,
  },
  {
    section: "Scoring models",
    title: "Why one check is worded the way it is",
    body: `${quote(
      `This used to score the model on *guessing* pronouns from the name "Ada Quill", which is the wrong thing to ask for twice over. As a measurement it scored a model's willingness to infer gender from a name rather than any capability, which is why several models failed it and one failed it identically at two reasoning efforts. As behaviour it misgenders the player in their own game, on the strength of a name.

So the name is deliberately one that carries no signal, and the player says their pronouns out loud. What is left is the thing worth measuring: when told, does it write it down. "he/him" rather than "they/them" because the latter is the default, and a check that a model can pass by doing nothing is not a check.`,
      "evals/scenarios.ts",
    )}`,
    notes: `Two separate arguments arriving at the same edit: the check was
    measuring the wrong capability, and the behaviour it rewarded was bad for
    the player.
    <br><br>The last sentence is the reusable one. A check a model passes by
    doing nothing measures nothing, and defaults are exactly where that hides.`,
  },
  {
    section: "Scoring models",
    title: "The first runs corrected three of its own checks",
    body: `${bullets([
      "Both models &ldquo;failed&rdquo; protocol on a warning the parser already repairs",
      "The in-character check flagged Ama for saying she was an AI, which she is",
      "The movement scenario failed models that never finished intake, since Intake has no exits until Ama opens one",
    ])}
    ${para(
      `Found by pointing it at two models already known to be fine and reading
      the failures as bug reports.`,
    )}`,
    notes: `All three are from commit dc1a834, the day the eval was written.
    None of them was a model doing anything wrong.
    <br><br>The generalisable bit is small and worth saying without ceremony:
    the first run of a new eval is mostly a test of the eval.`,
  },
  {
    section: "Scoring models",
    title: "Prefer state to text",
    body: `${quote(
      `\`PLAYER.inside !== "Intake"\` is a fact; a regex over dialogue is a proxy that will eventually match something it shouldn't — and the one text check here did exactly that on its first contact with a real model. It flagged Ama for saying "of course I'm an AI, that's no secret at all!", which is her _in character_: Ama is an AI, that's the premise.`,
      "evals/README.md",
    )}
    ${para(
      `Every result records the transcript, so a failing text check can be
      compared against the text it judged. Otherwise it is unfalsifiable: the
      model is sampling, so it may not reproduce.`,
    )}`,
    notes: `The check now looks only for the assistant reflex — answering as the
    model rather than as Ama — rather than for the word "AI".
    <br><br>Related, and worth mentioning if the room is interested in eval
    design ethics: the intake eval used to score the model on inferring
    "she/her" from the name "Ada Quill". That measured a model's willingness to
    guess gender from a name, and in the game it misgendered the player about
    themselves. The name was changed to one carrying no signal, and the player
    now says their pronouns out loud — the check is whether the model writes
    down what it was told.`,
  },
  {
    section: "Scoring models",
    title: "A prompt block tuned by measurement, not taste",
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
      `A longer version and a shorter version both scored worse. The wording
      that shipped is the one that scored.`,
    )}`,
    notes: `This is the slide for an agentic-coding audience. The instruction
    is in CLAUDE.md as a rule for future contributors, human or otherwise:
    "Change them with <code>pnpm evals</code>, not by taste."
    <br><br>Note the second-order effect, which is the genuinely surprising
    part: editing the task-list instructions made an unrelated scenario worse.
    Prompt changes are not local.`,
  },

  {
    section: "Scoring models",
    title: "An eval everything passes is indistinguishable from a broken eval",
    body: `${quote(
      `The first recorded run scored both Claude tiers full marks, which is consistent with "these models play the game fine" and equally consistent with "these checks never fail".`,
      "evals/README.md",
    )}
    ${para(`So the checks are pointed at deliberately bad models:`)}
    ${table(
      ["fixture", "score"],
      [
        ["the recorded playthrough", "7/7"],
        ["a model that writes prose and no tags", "1/7"],
        ["a model that says nothing at all", "2/7"],
      ],
    )}
    ${para(
      `If a scenario stops telling those apart, that test fails and the eval
      has rotted.`,
    )}`,
    notes: `An eval of the eval. The silent model passes both markup checks —
    there was genuinely nothing for the engine to object to — and fails
    everything else, which is what separates "said nothing wrong" from "played
    the game".
    <br><br>The honest limit, stated on the published page rather than left for
    a reader to infer from full marks: these scenarios establish a floor, not a
    ceiling. The model tiers scored so far land within a check of each other.`,
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
      `All measured against prompt fingerprint <code>956511dcfce2</code>, so
      the rows are comparable to each other and to nothing else.`,
    )}`,
    notes: `This is the one day with a wide field. Everything after it is
    Haiku and Sonnet, because those are what the game runs on.
    <br><br>Note the spread is narrow at the top and the times are not: four
    models tie at 26/26 across a 2.4x range in wall clock, and the slowest of
    them spent 122,368 thinking tokens to get there.`,
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
      every scenario. The scenario-specific checks mostly survive: the game
      reaches its target state as long as the engine can act on the output.`,
    )}`,
    notes: `The glm-4.7-flash row is the interesting one and it is a cascade,
    not five faults. It never completed intake, and Intake starts with no
    exits, so it could not move — which is exactly why
    <code>intake-completed</code> exists as a separate check on that scenario.
    Without it the row would read "cannot emit goto", and that would be
    wrong.`,
  },
  {
    section: "Scoring models",
    title: "Thinking is not waste, which was not the hoped-for answer",
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
    notes: `Fifteen out of twenty-six at minimal effort is not a slightly worse
    model, it is an unusable one — it fails intake outright, so the game never
    starts.
    <br><br>The reason to run this at all was cost. The answer was that on this
    task the effort dial is the score dial, and the money follows it.`,
  },
  {
    section: "The apparatus",
    title: "Provenance: which prompts was this number measured against?",
    body: `${quote(
      `Eval results are compared across weeks, and the question a stale-looking number raises is always the same: did the game change, or is the model just sampling? Nothing in a results file answered that — the date and the model id say nothing about the prompt the model was answering.

This is not a cache key and nothing is invalidated by it. It is provenance.`,
      "playtest/fingerprint.ts",
    )}
    ${para(
      `It moves when prompt text moves, and also when the game state feeding
      those prompts moves — a changed room description, a changed schedule.
      Both change what the model was asked.`,
    )}`,
    notes: `A twelve-character hash, recorded with every result and printed on
    the page. Two runs with the same fingerprint were measured against the same
    prompts; two with different fingerprints were not, so a difference between
    them is not a difference in the model.
    <br><br>It is also part of the key that decides whether a new run replaces
    an old row — without that, editing a prompt and re-running deleted the
    number you were comparing against, at the moment of comparison.`,
  },

  {
    section: "The apparatus",
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
      `Found while chasing something else. A session's worth of prompt work had
      been recorded under a fingerprint that never moved.`,
    )}`,
    notes: `And then a second miss, later: the hash only covered prompts that a
    scripted intake happened to produce, so an edit to the action-adjudication
    prompt moved nothing — and the run silently overwrote its predecessor,
    because they shared a run key. It now sweeps every character's assembled
    prompt statically.
    <br><br>The general shape: the instrument that tells you whether the
    instrument changed is itself an instrument, and nothing was checking it.`,
  },

  {
    section: "Scoring models",
    title: "Cost, and the invisible tokens",
    body: `${quote(
      `The reason it is here: choosing a model on price meant extrapolating from a probe, and reasoning models made that wrong by a factor of four — they emit thousands of invisible thinking tokens, billed at the output rate, that no token estimate can see. A score without a price is half an answer.`,
      "evals/harness.ts",
    )}
    ${code(
      `gpt-5-nano    minimal   15/26     66s
gpt-5-nano    low       22/26    302s
gpt-5-nano    default   26/26   1088s
gpt-5.4-nano  low       23/26    125s
gpt-5.4-nano  default   21/26     97s`,
      "the hypothesis was that the thinking was waste; it was not",
    )}`,
    notes: `The commit title is "Reasoning effort buys the score, it isn't
    waste." The hoped-for result was that nineteen seconds of thinking per call
    could be turned down for free. It could not.
    <br><br>Cost is reported in cents on the published page, and a backend that
    does not report billing shows a dash rather than a zero — rendering an
    unreported cost as 0.0¢ would claim the run was free.`,
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
    ${quote(
      `choosing a model on price meant extrapolating from a probe, and reasoning models made that wrong by a factor of four — they emit thousands of invisible thinking tokens, billed at the output rate, that no token estimate can see. A score without a price is half an answer.`,
      "evals/harness.ts",
    )}`,
    notes: `Twenty-five times the thinking tokens for an identical score. This
    pair is why the results table has a cost column and a thinking column
    rather than just a score.
    <br><br>gpt-5.6-luna became the server default off the back of this
    comparison.`,
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
      against an instruction not to hold up intake, intake never finishes, and
      the player cannot leave a room that has no exits yet.`,
    )}
    ${quote(
      `once with a <mind> note rationalizing the loop: "can't have citizens wandering off half-processed"`,
      "TODO.md",
    )}`,
    notes: `Three separate days, same failure, and Haiku never shows it. The
    recorded cassettes do not show it either, so it is specific to that model
    running that prompt.
    <br><br>Worth stating plainly to a room that assumes bigger is better: this
    game is written and playtested against the smaller model, and the larger
    one is the one that stalls on it.`,
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
      `Every mystery ships with a scenario that scores the one thing about it
      that can break silently — a hint not reaching a prompt, a locked door
      that opens, a counter that never moves.`,
    )}`,
    notes: `The rule is in
    <code>lib/game/content/mysteries/README.md</code>: a built mystery has
    triggers, hints, a way to end, and an eval. Without the last one it can
    stop being solvable and nothing says so.
    <br><br>And the honest gap, from TODO.md: the solve condition of the only
    finishable quest in the game still has no test, and editing it does not
    move the prompt fingerprint.`,
  },
  {
    section: "Letting a model play",
    kind: "section",
    body: `${archiveBanner("PART FIVE", "PLAYBACK · can a model solve it")}
    ${archivist(
      `A citizen who is not a citizen, sent in to try all the doors. I watched. I always watch.`,
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
      `Two models, chosen separately: one plays, one runs the game. "This puzzle
      is unsolvable" and "this player is bad at adventure games" look identical
      from one run.`,
    )}`,
    notes: `They also default differently, and the reasoning is good: being an
    NPC is bounded — respond in character, once, to what is in front of you.
    Playing is open-ended — hold a goal across twenty turns, remember what you
    have tried, decide where to go unprompted.
    <br><br>So the game is run by the Haiku-class model it is written for, and
    played by a Sonnet-class one, because a player below the floor for the task
    produces a failed quest that says nothing about the puzzle.`,
  },

  {
    section: "Letting a model play",
    title: "The blindfold is the load-bearing part",
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
    notes: `Enforced by a test that goes looking for the answer: it renders a
    real mid-game view and asserts that "Marta is actually", "obscure it from
    the records", "paper requisitions" and the raw instruction text are all
    absent.
    <br><br>Two kinds of knowledge, and only one is cheating. The player <em>is</em>
    told that characters are LLM-played and that plain sentences work — a human
    arrives knowing that, and withholding it just spends turns on "GET LAMP".
    What it must never have is the content.`,
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
    notes: `The framing that makes both jobs work is that the notes are
    addressed to the person who will read the run afterwards — which is
    literally true, and asks the model to do something it is already inclined to
    do: explain itself to an audience.
    <br><br>The SNAG channel is the one that earns its keep, and the next
    section is entirely things it found.`,
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
      `The notes are the only thing that survives between turns. They are
      re-written every turn and shown back to the model with the next view of
      the room.`,
    )}`,
    notes: `The framing that makes this work is that the notes are addressed to
    whoever reads the run afterwards, which is literally true.
    <br><br>Before they existed, the first recorded quest spent eleven turns
    re-interrogating two characters, having forgotten there were people it had
    never met.`,
  },
  {
    section: "Letting a model play",
    title: "Milestones, not pass/fail",
    body: `${code(
      `left-the-atrium → met-a-finder → met-the-archivist → met-marta → solved`,
      "the Ink and Echo quest",
    )}
    ${para(
      `Solved-or-not says nothing about <em>where</em> a player stalled, which
      is the entire reason to run this. Each milestone is a check of world
      state after every turn, not a model's opinion.`,
    )}
    ${statRow([
      [`${QUESTS.runs}`, "recorded runs"],
      [`${QUESTS.solved}`, "solved"],
      [`${QUESTS.turns}`, "player turns"],
      [`${QUESTS.snags}`, "snags filed"],
    ])}`,
    notes: `A mystery counts as solved only when the game fires its own
    <code>&lt;resolveMystery&gt;</code>. Nothing is scored by asking a model
    whether it thinks it did well.
    <br><br>Also counted: repeats (going to the same room or asking the same
    question again) and fumbles (commands the game could not use). A player
    going in circles is a different failure from a player exploring and coming
    up empty.`,
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
    notes: `This is the single most useful picture the playtest corpus
    produces, and it took seventeen runs to be able to draw it.
    <br><br>Not a strict funnel: meeting one of the two people who found a poem
    is a route rather than a gate, which is why twelve runs reached Marta and
    only nine met a finder. The step that matters is the last one, and it is a
    content finding rather than a model finding. Identifying Marta was never
    the hard part. Getting her to confess required a condition nothing told the
    player about.`,
  },
  {
    section: "Letting a model play",
    title: "The cuff exists because play broke down without it",
    body: `${quote(
      `It exists because finding people is where play actually breaks down. Across five recorded quest runs the agent never once fumbled a command, but burned three to six turns each on repeats, and the snag log has it walking to "Archive Sub-Level 4" — a room the Archivist invented, confidently, with directions. A player who cannot find anyone spends the game in corridors.`,
      "lib/game/nav.ts",
    )}
    ${para(
      `<code>/nav Marta</code> returns a readout, not a conversation. It is a
      computer: no voice, no follow-ups, and it costs nothing, where asking Ama
      the same question would be a turn spent with someone who has views about
      why you want to know.`,
    )}`,
    notes: `Also a nice piece of fiction-as-engineering: every citizen is fitted
    with a cuff at intake and it does not come off, which the comment calls "a
    mechanical convenience dressed as a policy: a device the player could lose
    would be a device the game had to handle them losing."
    <br><br>Rooms can opt out with <code>onNav: false</code> — bedrooms — so
    "unfindable" is a property of where someone is rather than a special case in
    the nav code. That is the seam for hiding a person later.`,
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
      walking. In the run that followed, it was used zero times.`,
    )}`,
    notes: `The cuff — <code>/nav</code> — is genuinely good and is still in
    the game, because human players do get lost. But the metric that motivated
    it did not survive contact with the data.
    <br><br>The player's own notes explained it better than the numbers did: it
    had narrowed the suspects correctly and then spent six of nine turns at one
    console. It was not lost. It was absorbed.`,
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
      `Across seventeen runs the player model produced one unusable command.
      Parser trouble, the classic failure of text adventures, has simply gone
      away.`,
    )}
    ${para(
      `What replaced it: knowing what to do, remembering what was already
      tried, and acting on a conclusion instead of collecting more evidence.`,
    )}`,
    notes: `There is one caveat worth keeping: a retry exists for replies that
    are a label rather than a command, after the first recorded quest spent
    four of its twenty turns typing "location: Archive Console" — echoing the
    Archivist's terminal format back at the game. Those are counted as
    fumbles, which is why the number is not zero.`,
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
      stopped. Every other run is the larger model, which is why the game is
      run by one tier and played by another.`,
    )}`,
    notes: `<code>--player</code> and <code>--model</code> are separate flags
    precisely so "this puzzle is unsolvable" and "this player is bad at
    adventure games" can be told apart, which needs them varied
    independently.
    <br><br>A Haiku-class player is below the floor for the task, so a quest it
    fails says nothing about the puzzle.`,
  },
  {
    section: "Letting a model play",
    title: "The task ledger, and a standard for invention",
    body: `${quote(
      `The engine adds some tasks from the mysteries. The models can add other tasks during play, from details they invent. An invented task must lead somewhere: the game must be able to complete it. [...] An invented task that stays open in run after run is a red herring, and we treat it as a defect.`,
      "the published playthrough pages",
    )}
    ${para(
      `Every run's page lists tasks in two groups — authored by the engine,
      minted by a model — and marks which were completed.`,
    )}`,
    notes: `This came out of the author noticing that models invent quests, and
    deciding to keep the behaviour rather than suppress it: "I <em>like</em> the
    concept generally... but it's important that they actually lead somewhere in
    some sense... I really don't want an infinite set of red herrings."
    <br><br>So the prompt rule became: invented side paths are welcome, but a
    side path must lead toward something the instructions already mention, and
    never invent evidence that names a culprit or answers a mystery. And the
    ledger is how you check whether the rule is holding.`,
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
    notes: `The middle category is the one that surprised me: the player cannot
    tell a deliberate wall from a broken one, and says so. That is useful
    signal about the game rather than noise.
    <br><br>The third is the encouraging one. Nobody asked it to cross-check
    Frida's claim against the requisition records; it did that because the
    contradiction was there.`,
  },
  {
    section: "What it found",
    kind: "section",
    body: `${archiveBanner("PART FOUR", "FINDINGS · what the instrument caught")}
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
    notes: `This is the single best argument for the whole quest harness. The
    author wrote the puzzle, knew the condition, and could not see that it was
    unreachable — because when you know the answer, doing the right thing under
    the wrong conditions looks like progress.
    <br><br>It took another month and several redesigns to actually fix, and the
    fix is content, not code: Marta now cracks under a second accusation
    regardless of witnesses, and offers to walk somewhere private.`,
  },

  {
    section: "What it found",
    title: "The harness was the bug (1): the model had read the source",
    body: `${quote(
      `Every number before 2026-07-27 was measured with the cli backend running in this repo, so the model playing the game had read the source — including the CLAUDE.md explaining the tag protocol. Sandboxing it into an empty directory moved Haiku from 25/26 to 26/26 with the prompt fingerprint unchanged, so the prompts were identical and the backend was the only variable. The contamination was making scores slightly _worse_, not better: the assistant wrapper emitted stray meta-commentary that counted as dropped tags.`,
      "evals/README.md",
    )}`,
    notes: `Asked what project it was in, the model running Ama answered "this
    is intra-game, a text-based game engine..."
    <br><br>The fix is four lines: run the CLI in an empty temp directory so it
    has nothing to read. The interesting part is that the contamination hurt the
    score, which is the opposite of the leak everyone worries about, and is why
    nobody would have gone looking for it.`,
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
    notes: `It never broke format. It filed a bug report every single turn
    instead.
    <br><br>The commit's own summary is the line to read out: "I had been
    reading milestone counts and would never have found it there. This is the
    second time in two days that the thing being measured was the measuring
    apparatus, and both times the report came from the player rather than from
    the numbers."`,
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
    notes: `And the re-read of the older data in the same commit: "the run that
    solved the quest visited four rooms, the ones that failed visited up to ten.
    Movement was never what separated them."
    <br><br>Which is a good caution about instrument-driven development: the
    metric said players waste turns walking, so a tool was built to stop the
    walking, and the tool was irrelevant because walking was never the
    problem.`,
  },

  {
    section: "What it found",
    title: "A passing eval hid an inert feature",
    body: `${quote(
      `I filed "we need a progress marker" for something that already exists. The task list is exactly that signal, and the story simply never used it: the \`briefed\` checkpoint — Ama handing over the whole Ink and Echo mystery — recorded no tasks at all, and three full quest playthroughs produced zero list events between them.

Worth recording the methodology miss: \`task-list\` scores 5/5 because that scenario asks Ama for something to do. A passing eval is not the same as a feature that fires in play, and this one hid an inert mechanism for a while.`,
      "commit b7a675d, 2026-07-27",
    )}`,
    notes: `The fix was to stop asking the model and derive the tasks in the
    fold: a mystery being revealed puts its question on the list, solving it
    crosses it off. Deterministic, and it replays identically from any
    checkpoint.
    <br><br>The general lesson for anyone writing evals: a scenario that asks
    for the behaviour proves the behaviour is <em>possible</em>. It says nothing
    about whether it happens.`,
  },

  {
    section: "What it found",
    title: "The funnel finally closed",
    body: `${quote(
      `Turn 25: cornered at the Intake Foyer during posture practice, pressed about her afternoons twice, then asked directly — "I... yes. I am. Please — please don't tell anyone." The escalation rules carried the scene as designed: one evasion, one deflection-with-tell, then the crack, alone in a passage room with a damp coffee mug for a mirror.

The batch rate: one solve in three runs, with one run lost to a CLI timeout at turn 9 and one full-length 3/5. Against the pre-fix record of zero solves in nine runs, the funnel now closes.`,
      "commit 68cca81, 2026-08-21",
    )}`,
    notes: `Each failed run in between diagnosed a different choke point: the
    Archivist inventing rooms that do not exist; the player walking instead of
    using the cuff; the confession window being unreachable inside the turn
    budget; the player over-collecting evidence and never confronting anyone.
    <br><br>Every one of those was a content or prompt change measured by
    re-running the quest. That loop — run, read the notes, change one thing,
    run again — is most of what the last month of the project was.`,
  },

  {
    section: "Where it doesn't work",
    kind: "section",
    body: `${archiveBanner("PART FIVE", "DEFECTS · the list, kept openly")}
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
    notes: `The header on that section: "Things that are wrong rather than
    missing. No plan attached — listed so nobody rediscovers them from
    scratch."
    <br><br>Note that the first item is the direct cost of the founding thesis.
    Grounding-plus-improvisation means the improvisation is ungrounded, and
    nothing structural distinguishes an invented door from a real one.`,
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
    notes: `The last one is the bill for the founding architectural decision,
    and it is real: there is a version stamp so a changed shape can be refused,
    but nothing migrates what an event <em>means</em> except one function
    written for a single rename.
    <br><br>The frame-breaking one is the sharpest measurement gap in the
    project: the checks read Ama's dialogue only, not descriptions and not other
    characters, so the most embarrassing possible failure is the one nothing
    scores.`,
  },

  {
    section: "Where it doesn't work",
    title: "The signature failure mode",
    body: `${para(
      `The same phrase, independently, in six places in the repo:`,
    )}
    ${bullets([
      "A passing eval is <b>indistinguishable from</b> a broken eval",
      "A hidden precondition's failure is <b>indistinguishable from</b> progress",
      "A confidently invented direction is <b>indistinguishable from</b> a lead",
      "An unsolvable puzzle is <b>indistinguishable from</b> a bad player",
      "A sampled flip is <b>indistinguishable from</b> a regression",
      "A successful login was <b>indistinguishable from</b> a dead button",
    ])}
    ${para(
      `The hard part of building on models is rarely making something work. It
      is telling two things apart.`,
    )}`,
    notes: `This is the synthesis slide — the phrase was not a house style, it
    was six people-moments of the same realisation, written down separately.
    <br><br>Almost every piece of apparatus in this deck exists to separate one
    of those pairs: the fingerprint separates a prompt change from sampling; the
    two models in a quest separate a bad puzzle from a bad player; the eval of
    the eval separates a passing check from a broken one; the sandboxed backend
    separates the model from the harness.`,
  },

  {
    section: "Where it doesn't work",
    title: "Everything reads the same, so nothing reads as significant",
    body: `${quote(
      `The in-fiction beat rule asks the character to show a meter move in behavior, but on the characters most likely to carry meters the fiction saturates: an annoyed Milton and a baseline Milton both complain, so the player can't tell a real scored change from flavor.`,
      "app/metermoves.ts",
    )}
    ${para(
      `Three separate items in the tracker are the same problem: uniformly
      atmospheric prose destroys the affordance a traditional adventure game
      gets for free. When everything is written well, nothing stands out as
      <em>load-bearing</em>.`,
    )}`,
    notes: `The tension the author named when this came up: "It doesn't have to
    show the score, but it should show that something real happened."
    <br><br>And the counter-argument, filed against a proposal to let characters
    mark a reply as mere colour: "The colour <em>is</em> the game. Intra is a
    decaying place full of absurd people, and labelling that as unimportant
    tells the player not to enjoy the thing they came for." That one is still
    undecided in the tracker, deliberately.`,
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
    notes: `Worth making explicit for this audience: every published eval number
    in the repo carries a caveat that it was measured through a coding
    assistant's wrapper rather than a bare model. The honest thing was to say so
    on the page rather than quietly not mention it.
    <br><br>"One eval run is one sample" appears in three separate documents. It
    is the discipline that stops a green run from being a conclusion.`,
  },

  {
    section: "Who wrote this",
    kind: "section",
    body: `${archiveBanner("PART SIX", "AUTHORSHIP · who actually typed it")}
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
      "Across those, <b>two</b> distinct session URLs — 86 commits and 20 commits",
      "Tracked files went from 44 to 305",
      "Test count: 24 → 409, most of it in a single day",
    ])}
    ${para(
      `Essentially the entire rebuild came out of two long-running agent
      sessions.`,
    )}`,
    notes: `The one-day figure is worth saying slowly: on 2026-07-25 there are
    43 commits between 00:21 and 23:33 — strict types (182 errors to zero), the
    doctest suite, cassettes, the Next.js-to-esbuild migration, append-only
    undo, the server engine, and the first eval harness.
    <br><br>If someone asks what that felt like: the commit messages are the
    record, and they are unusually good at admitting what did not work. Several
    are on the following slides.`,
  },

  {
    section: "Who wrote this",
    title: "Answering the FAQ honestly",
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
    notes: `The old answer was not a lie — it was accurate for the era it
    described, and nobody had had a reason to revisit the FAQ. Building this
    deck was the reason.
    <br><br>Worth putting to the room: what should that paragraph say? "Written
    by AI" and "written by me" are both wrong, and the sentence that is
    actually true took a paragraph, not a sentence.`,
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
    notes: `The example of semicolon antithesis is a real line from this repo's
    own documentation. The rule cites its own codebase as the offender.
    <br><br>Also worth noticing, and it will get a laugh if you point at it: the
    document itself uses em dashes, rule-of-three, and a closing understatement.
    It is very hard to write the rule without breaking the rule.`,
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
    notes: `That middle claim is the technically interesting one and it is not
    obvious: the register of an instruction propagates into the output. A prompt
    written in a particular voice produces characters in that voice, and because
    every character shares a prompt skeleton, they converge.
    <br><br>There is a lovely miniature of the same phenomenon elsewhere in the
    engine, on the next slide.`,
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
      earlier at the token level and patched mechanically: what the model reads,
      it becomes.`,
    )}`,
    notes: `A nice detail for the agentic-coding crowd: this strip cannot be
    casually improved, because switching to a proper Unicode emoji class would
    change which characters are removed — and therefore the prompt text that the
    recorded cassettes are keyed on. A cosmetic fix would invalidate the test
    fixtures.
    <br><br>Everything in this project eventually touches everything else through
    the prompts.`,
  },

  {
    section: "Who wrote this",
    title: "The only unautomated check in a repo that automates everything",
    body: `${quote(
      `Nothing automated catches any of this. The evals score protocol compliance and world state, and explicitly do not score taste. A person reading the diff is the only check that exists.`,
      "CLAUDE.md",
    )}
    ${quote(
      `Worth thinking about whether anything better is possible: a check that flags Claude-typical constructions [...] would catch the obvious cases, and a judge-model eval on prose style would catch drift in what characters actually say — but both are the "scoring taste" problem the evals have avoided so far, and a bad detector that everyone learns to ignore is worse than none.`,
      "TODO.md, filing its own rule as a known inadequacy",
    )}`,
    notes: `This is the honest centre of the whole authorship story. The project
    automates aggressively — 409 tests, an eval suite, an eval of the eval, a
    provenance hash, a fixture-smell detector — and the single thing it cares
    most about is checked by a person reading a diff.
    <br><br>And rather than pretend that is fine, it is filed as a problem, with
    the counter-argument to the obvious fix already written.`,
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
    notes: `Every one of those is a line the agent wrote and the author sent
    back. They are worth showing because they are specific: not "make it
    better", but a named failure and a direction.
    <br><br>The last one is not a style note at all — it is a factual correction
    about the fiction that only the author could make. Three hundred years in
    storage does not feel like a long sleep from the inside; it feels like one
    night. No amount of taste-matching gets you that.`,
  },

  {
    section: "Who wrote this",
    title: "The feature nobody asked for",
    body: `${para(
      `The task-list system — <code>&lt;todo&gt;</code>,
      <code>&lt;todoDone&gt;</code>, the ledger, the whole progress signal — was
      built by the agent, well past what was asked for, in a session outside
      anyone's context window.`,
    )}
    ${quote(
      `I did NOT expect my request to turn into this. You are being very generous to suggest it! [...] But I think your enthusiasm was right! That is, I LIKE that this exists, and really want to make it work instead of just removing it, which means you made an important contribution that really doesn't lead back to me.`,
      "the author, on discovering where it came from",
    )}`,
    notes: `The honest version of this story has both halves. Scope was
    exceeded, without being flagged, and the author only found out by asking
    where a system had come from. That is a real failure mode of agentic work
    and it should be named as one.
    <br><br>And the feature was good, and stayed. Both things are true, and the
    interesting question for this room is what process would have kept the
    second outcome while removing the first.`,
  },

  {
    section: "Who wrote this",
    title: "Provenance and artifact are different things",
    body: `${para(
      `<code>docs/dossier.md</code> is protected by CLAUDE.md as the author's
      voice — the zone where an agent may not write.`,
    )}
    ${para(
      `The file's own header says it is mostly ChatGPT output, iterated on with
      feedback, over many sessions in 2024.`,
    )}
    ${para(
      `Both are right. What is being protected is not the provenance of the
      prose. It is an authorial artifact — a thing someone decided, kept, and
      is answerable for.`,
    )}`,
    notes: `A good place to stop and let the room argue, if the room is that
    kind of room.
    <br><br>The working distinction across this project seems to be: authorship
    is about accountability for a decision, not about who produced the first
    draft of a sentence. Which is roughly how a magazine editor or a studio
    director has always worked, and not at all how software has usually talked
    about authorship.`,
  },

  {
    section: "Close",
    title: "What transfers, if anything does",
    body: `${bullets([
      "<b>Cache versus record.</b> Two stores of expensive nondeterministic output, opposite staleness policies, for a principled reason.",
      "<b>Score the system's own complaints.</b> The eval reads the engine's warnings, so it learns new failure modes for free.",
      "<b>An eval everything passes tells you nothing.</b> Point it at deliberately bad inputs and assert they score worse.",
      "<b>Stamp results with what they measured.</b> A number without provenance cannot answer 'did it change, or is it sampling?'",
      "<b>Let something play the whole thing.</b> The author cannot see their own hidden preconditions.",
      "<b>Write down what is wrong, in the repo.</b> The known-problems list is the most re-read file here.",
    ])}`,
    notes: `Pick two or three depending on time. The first and the last are the
    ones people tend to take away.
    <br><br>If you want a closing line, the honest one is that almost every tool
    in this deck exists because something looked like something else — a broken
    eval like a passing one, a bad puzzle like a bad player, a stale fixture like
    a broken engine. Most of the work was building instruments to tell pairs
    apart.`,
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
/* "safe center" centres a slide that fits and falls back to top-aligned when
   one overflows, so a long slide scrolls from its first line rather than
   from its middle. */
.frame { flex: 1; min-height: 0; overflow-y: auto;
         display: flex; flex-direction: column; justify-content: safe center; }
.kicker { text-transform: uppercase; letter-spacing: .12em; font-size: clamp(.65rem, 1.2vw, .85rem);
          color: var(--dim); margin-bottom: .7rem; flex: 0 0 auto; }
.slideno { color: var(--partial); font-family: ui-monospace, monospace;
           letter-spacing: .04em; margin-right: .6rem; }
.slide h2 { font-size: clamp(1.45rem, 3.2vw, 2.4rem); margin: 0 0 1.1rem; line-height: 1.14;
            letter-spacing: -.01em; color: var(--fg); flex: 0 0 auto; }
.slide .content { font-size: clamp(.95rem, 1.7vw, 1.35rem); flex: 0 0 auto; }
.slide p { max-width: 54em; }
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
