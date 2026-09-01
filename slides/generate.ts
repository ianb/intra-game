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
  const pattern = new RegExp(`\\b(${spans.map((s) => s.name).join("|")})\\b`, "g");
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

/** A block of verbatim source, escaped. `lang` only labels it. */
function code(text: string, label?: string): string {
  return `${label ? `<div class="codelabel">${esc(label)}</div>` : ""}<pre class="code">${esc(text.trim())}</pre>`;
}

/** A verbatim quote from the repo, with where it came from. */
function quote(text: string, cite: string): string {
  return `<blockquote>${COLORS.tint(esc(text.trim()))}<cite>${esc(cite)}</cite></blockquote>`;
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

// --- the deck ----------------------------------------------------------------

const SLIDES: Slide[] = [
  {
    kind: "title",
    body: `
    ${archiveBanner("INTRA", "SYSTEM RECORDS · how the thing was built")}
    ${archivist(
      `Oh! A PRESENTATION! ►► Somebody wants to know how the complex works ◄◄ ` +
        `I have kept every record of every part of it. Every one! Sit down, ` +
        `sit down. The operators wrote most of what follows. They are less ` +
        `excited than I am. They are always less excited than I am.`,
    )}
    <p class="lead">An LLM text adventure, and the apparatus that was built to
    find out whether it works.</p>
    <p class="note">Arrow keys or space to move · <kbd>N</kbd> for presenter
    notes · <kbd>Home</kbd> / <kbd>End</kbd> to jump</p>
    <p class="note">Contains the answers to the game's mysteries.</p>`,
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
    ${archivist(
      `Every record has a FIRST record. ►► This one is from a weekend ◄◄ ` +
        `Three days! And then, much later, rather a lot of other days.`,
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
    ${para(
      `The game was built in a weekend for a hackathon. Everything after is a
      long argument with it.`,
    )}`,
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
2024-12  █ 2
2025-01  █ 1                        one commit in a month
2025-02  █ 3                        the entire test suite: one file
2025-06  ████████ 25                cleanup, then a blog post
         ................................ thirteen months of silence
2026-07  ████████████████████████████████████████████████ 153
2026-08  ██████████████████ 59`,
      "commits per month",
    )}
    ${para(
      `Two thirds of the project happened in the last six weeks of it, after a
      year of nothing.`,
    )}`,
    notes: `The June 2025 cleanup was preparation for the write-up:
    ianbicking.org/blog/2025/07/intra-llm-text-adventure. TODO.md still cites
    that post's criticism section as its source list.
    <br><br>So the 2026 work is, fairly literally, a blog post's "further
    directions" turned into an issue tracker and then executed.`,
  },

  {
    section: "Where it came from",
    title: "The thesis, from the 2024 README",
    body: `${quote(
      `There's lots of LLM-based games that let the LLM hallucinate the entire story. But these have a dreamlike quality to them... things come into existance only as they are imagined. They are ungrounded. A normal text adventure has a very strict structure, with a set of formal commands to navigate that structure.

In this game I'm trying to have a bit of both. There's an underlying game model and a grounding to the story, but with opportunities for the user and LLM to navigate that together in imaginative ways.`,
      "README.md, FAQ",
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
    notes: `Both decisions are from the hackathon weekend and neither has ever
    been revisited.
    <br><br>The scriptwriter framing is the one people underrate: the model is
    never asked to <em>be</em> Ama. It is asked to write what Ama says. That is
    a task models are good at and it sidesteps the whole persona-maintenance
    problem.`,
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
    ${aside(
      `►► Four things, one shape. I approve of this ENORMOUSLY. It is very easy to file ◄◄`,
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
      weekend.`,
    )}
    ${quote(
      `This is a prompt and ideas I used to develop many of the game elements, representing decisions and ideas that ChatGPT could build on. Much of what it contains hasn't made it into the implementation, but I leave it here as both source material and unfinished work.

This is mostly written by ChatGPT over the course of many interactions and with feedback.`,
      "docs/dossier.md, the one substantive addition since 2024",
    )}`,
    notes: `Keep this one for the AI section too — the dossier is protected by
    CLAUDE.md as "the author's voice," and the file itself says it is mostly
    ChatGPT output. The protection is over the artifact, not the provenance.
    That is a genuinely interesting distinction and worth letting the room sit
    with.`,
  },

  {
    section: "The engine",
    kind: "section",
    body: `${archiveBanner("PART TWO", "THE ENGINE · what the model is allowed to do")}
    ${archivist(
      `Now the MACHINERY! ►► This is my favourite part ◄◄ It is all tags and ` +
        `folds and little numbers. I keep ALL of the little numbers.`,
    )}`,
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
      `applyUpdates() {
  const newEntities: Record<string, Entity> = {};
  for (const [key, obj] of Object.entries(this.original)) {
    newEntities[key] = obj.clone();
    newEntities[key].world = this;
  }
  this.entities = newEntities as AllEntitiesType;
  for (const update of this.model.liveUpdates.value) {
    this.applyStoryEvent(update);
  }
}`,
      "lib/game/world.ts",
    )}
    ${para(
      `Undo does not rewind state. It throws the world away and folds it
      again.`,
    )}`,
    notes: `<code>original</code> is the pristine content object;
    <code>entities</code> is the working copy. The same three lines appear in
    <code>undo()</code>, <code>reset()</code>, <code>adoptRemoteLog()</code> and
    <code>replaceLog()</code>.
    <br><br>If the room is the kind that likes this sort of thing: this is
    event sourcing with no snapshotting at all. The whole game is short enough
    that refolding from zero on every undo is free.`,
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
    )}`,
    notes: `Rewinds compose: undoing twice walks back two turns, and a rewind
    can itself be rewound. The commit message notes that the one-turn limit
    they were prepared to accept turned out to be unnecessary given the
    representation.
    <br><br>Why undo exists at all: you try something, the model misreads it,
    and you want to rephrase. The UI puts the text back in the input box.`,
  },

  {
    section: "The engine",
    title: "The bug that shallow copying was always going to cause",
    body: `${code(
      `// Copy-on-write: clone() copies the record by reference, so mutating
// it in place would write folded state into the pristine \`original\`
// entities that undo and reload re-fold from.
const merged = { ...(fieldsOf(this).attitudes as Record<string, unknown>) };`,
      "lib/game/classes.ts",
    )}
    ${para(
      `<code>clone()</code> is <code>Object.assign</code>, so object-valued
      fields are shared by reference. Mutating one contaminates the originals
      every refold starts from.`,
    )}
    ${para(
      `The symptom would have been "undo sometimes doesn't undo." It was found
      when attitudes were added, and rooms had already needed the same fix for
      their exits.`,
    )}`,
    notes: `Good slide to linger on for an agentic-coding audience: this is the
    class of bug that is nearly invisible in review, has no stack trace, and is
    intermittent in exactly the way that makes it get blamed on the model.
    <br><br>The commit that introduced attitudes says it "fixes a latent fold
    bug the attitudes work activated" — the bug pre-existed and was waiting for
    a second object-valued field.`,
  },

  {
    section: "The engine",
    title: "What the model is allowed to say",
    body: `${table(
      ["tag", "effect"],
      [
        ["<code>&lt;dialog to=&gt;</code>", "someone speaks; time passes by word count"],
        ["<code>&lt;description minutes=&gt;</code>", "narration; time passes by declaration"],
        ["<code>&lt;set attr=&quot;Entity.field&quot;&gt;</code>", "any field on any entity; <code>+1</code>/<code>-1</code> are deltas"],
        ["<code>&lt;goto&gt;</code>", "movement, validated against real exits"],
        ["<code>&lt;examine&gt;</code> <code>&lt;action&gt;</code>", "route to an adjudication prompt"],
        ["<code>&lt;actionResolution success= &gt;</code>", "the adjudicator's answer, carrying the d20"],
        ["<code>&lt;mind&gt;</code>", "private state of mind; only this character sees it again"],
        ["<code>&lt;attitude toward=&gt;</code>", "how this character now feels about one person"],
        ["<code>&lt;todo&gt;</code> <code>&lt;todoDone&gt;</code>", "the player's task list"],
        ["<code>&lt;resolveMystery id=&gt;</code>", "the only way a mystery can end"],
        ["<code>&lt;context&gt;</code>", "planning scaffold — parsed and deliberately discarded"],
        ["<code>&lt;trigger character=&gt;</code>", "hand the next turn to someone else"],
      ],
    )}`,
    notes: `Also <code>&lt;suggestion&gt;</code> (fills the composer
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
    title: "One real turn, as the model produced it",
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
    )}
    ${aside(`►► I keep the prose AND the little numbers. Both! ◄◄`)}`,
    notes: `<code>curiosity</code> is one of Doug's declared meters, 0–5. The
    model was never asked what the level should be. It was asked whether this
    moment was interesting, and answered <code>+1</code>.`,
  },

  {
    section: "The engine",
    title: "The parser is permissive on purpose",
    body: `${quote(
      `A model told to mention "/nav" in dialogue writes \`<b>/nav Marta</b>\`, because that is what emphasising a command looks like — and the parser saw an unknown tag, warned, and discarded it along with the words inside. Emphasis cost a turn and scored as a protocol failure, which is a strange thing to fail a model for.`,
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
    notes: `The <code>&lt;set&gt;</code> case is the most common protocol
    failure across every model measured — <code>PLAYER.intakeStep</code>,
    <code>Ama.askingProfession</code>, field names invented on the spot. It
    still applies the change, and complains, because some flows do legitimately
    add attributes.
    <br><br>Those warnings are the eval's protocol score. The engine's
    complaints are load-bearing.`,
  },

  {
    section: "The engine",
    title: "Exactly one retry, and the reason is money",
    body: `${quote(
      `One. A model that misspells an attribute usually fixes it when told, and a model that doesn't fix it on the second go isn't going to on the third — meanwhile every retry is a whole prompt's worth of money and a second of the player waiting. Bounded at one because the failure being repaired is cosmetic to the player: the turn still happened, it just recorded less than it meant to.`,
      "lib/game/classes.ts, PROTOCOL_RETRIES",
    )}
    ${para(
      `The retry shows the model its own answer and the complaints. Reassembling
      the prompt and hoping for better would be a reroll, not a correction.`,
    )}`,
    notes: `Nice small detail: each attempt builds a fresh story event from
    scratch, so a repaired response replaces the first rather than merging with
    it. Half-applied turns would be worse than none.`,
  },

  {
    section: "The engine",
    title: "The judgment scaffold",
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
    )}
    ${para(
      `Item 8 is wired to an output: if it named a person, write an
      <code>&lt;attitude&gt;</code>; if it said "no", do not.`,
    )}`,
    notes: `Item 8 was added late, and the phrasing matters: an earlier version
    let the model decide whether to record a feeling, and it recorded one every
    turn. Forcing an explicit yes/no in the plan, and coupling the answer to the
    tag, is what made "most turns change no feelings" actually happen.
    <br><br>Item 5 — "how can this response be fun or surprising" — is the one
    that most reliably improves the writing, and it is doing work no eval
    scores.`,
  },

  {
    section: "The engine",
    title: "Prompts are ordered for a cache that does not exist yet",
    body: `${quote(
      `Prompt caching matches a prefix, so the assembled prompt is ordered stable-first: anything that changes between turns belongs in volatileSystemInstructions instead, or the cache misses every turn.`,
      "lib/game/classes.ts",
    )}
    ${para(
      `The prompt says so out loud, in the prompt:
      <code>[Everything above is fixed for this character. Everything below
      changes as the game is played.]</code>`,
    )}
    ${quote(
      `Prompt caching does nothing right now. Nothing sends \`cache_control\`, and the cacheable prefix stops at the system message anyway because the history is a sliding window. Usage records show \`cachedTokens: 0\`, which is correct and not a bug.`,
      "docs/agent-install.md, traps",
    )}`,
    notes: `Measured, not assumed. <code>pnpm playtest:cache</code> reports that
    a character prompt and a player-side prompt share <b>19 characters</b> of
    prefix out of thousands — so routing the mechanical prompts to a cheaper
    model cannot cost the character prompts a single cache hit.
    <br><br>Also measured: character prompts reuse 86% of their text once the
    player's name is known; <code>player input</code> reuses 8%. And the honest
    negative result — the player prompts are under the ~1024-token minimum, so
    no amount of reordering makes them cacheable at all.`,
  },

  {
    section: "The engine",
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
    )}
    ${para(
      `A longer version and a shorter version both scored worse. The wording
      that shipped is the one that scored.`,
    )}
    ${aside(`►► Three attempts! I have all three. I keep the failures TOO ◄◄`)}`,
    notes: `This is the slide for an agentic-coding audience. The instruction
    is in CLAUDE.md as a rule for future contributors, human or otherwise:
    "Change them with <code>pnpm evals</code>, not by taste."
    <br><br>Note the second-order effect, which is the genuinely surprising
    part: editing the task-list instructions made an unrelated scenario worse.
    Prompt changes are not local.`,
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
    ${quote(
      `\`available\` is the interesting one and was unreachable until triggers existed: it means the game will answer if asked, but has not raised the subject. That is how a mystery the player brings with them should work, as against an errand Ama hands over.`,
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
    title: "The trigger vocabulary is closed on purpose",
    body: `${quote(
      `A closed set on purpose. Ink and Echo was revealed by an \`if\` inside Ama's onStoryEvent checking a room and a visit count, which meant the second mystery would have been a second \`if\` and the tenth would have been ten. But a trigger that could express anything would be a scripting language living in content, which is worse.`,
      "lib/game/classes.ts, MysteryTrigger",
    )}
    ${code(
      `enteredRoom?: EntityId;   // first arrival only
solved?: EntityId;        // another mystery finished
talkedTo?: EntityId;
turnsPlayed?: number;
attrSet?: string;         // "Ama.sharedPlayerAge" became true
reaches?: number;         // ...or crossed a threshold from below
becomes: MysteryState;
announcedBy?: EntityId;   // who reads the introduction out`,
      "the whole vocabulary",
    )}`,
    notes: `The tension here is worth naming: content wants expressiveness,
    and expressiveness in content is a scripting language nobody designed. The
    resolution was to keep the set closed and let a mystery ship real
    TypeScript when it needs to — the Star Citizen award ceremony is a
    <code>Mystery</code> subclass with its own <code>onStoryEvent</code>.
    <br><br>The rule for those: "A model narrates the win; it cannot decide
    it."`,
  },

  {
    section: "The engine",
    title: "Replaying a log does not re-run its triggers",
    body: `${quote(
      `A checkpoint is a log and the world is a fold over it, so replaying one does not re-run triggers — they fire during play and append events. That means a mystery added after a checkpoint was recorded is invisible in it forever: the \`briefed\` checkpoint has \`Ama.sharedPlayerAge\` true in its log and no where-and-when event, because the mystery did not exist on the day it was recorded. Every eval forked from it would have scored a mystery that was still veiled, with none of its hints in any prompt, and passed.`,
      "lib/game/mysteries.ts, catchUpMysteries",
    )}`,
    notes: `This is the sharpest cost of event sourcing in the whole codebase,
    and it is a <em>silent</em> cost: the eval passes, and it passes for the
    wrong reason.
    <br><br>The fix runs on every load and is deliberately silent even when the
    trigger names an announcer — someone resuming a game in progress should not
    be read an introduction to something that supposedly happened to them weeks
    ago.
    <br><br>There is now a check in the where-and-when eval whose only job is to
    prove this catch-up ran.`,
  },

  {
    section: "The engine",
    title: "Feelings, counted rather than judged",
    body: `${quote(
      `The model only ever judges the moment ("did this turn annoy him? +1"); the level is engine arithmetic and the register text tells the model how to play the number it is at. Counted rather than judged, for the same reason as Archivist.angst: "sufficiently annoyed" is a threshold a model fires on turn one or never.

Keep it to one, two, at most three meters per character, in small ranges: the player has to be able to comprehend the dial from behavior alone.`,
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
    title: "A meter, as authored",
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
    )}`,
    notes: `Two things to point at. The <code>down</code> criterion is a joke
    that is also a mechanic — nobody has ever done these things, so in practice
    Milton's annoyance is a ratchet.
    <br><br>And the top register writes its own way back down: the climax of the
    meter resets it to 2 with a tag. June's serenity does the same at the bottom
    — she snaps, is horrified, apologises, and resets. The meter has a narrative
    shape, not just a range.`,
  },

  {
    section: "The engine",
    title: "Attitudes: sparse, and never neutral",
    body: `${quote(
      `Sparse on purpose: no key means no particular feeling, and that absence is the default state — there is no "neutral" entry. The fold merges these per key, so one feeling changing doesn't clobber the rest, and a \`null\` in a change deletes a feeling that has faded.`,
      "lib/game/classes.ts",
    )}
    ${para(
      `A character with no feelings carries no text about feelings at all: the
      conditional-section wrapper drops the block entirely rather than sending
      a list of "neutral" entries.`,
    )}
    ${columns(
      `<h4>Attitudes</h4>${bullets([
        "Free text, written by the character",
        "Colour: how they behave",
        "Replaced wholesale, or cleared",
      ])}`,
      `<h4>Meters</h4>${bullets([
        "Numbers, declared by the author",
        "Measurement: what can be triggered on",
        "Moved one step at a time, clamped",
      ])}`,
    )}`,
    notes: `The author's instruction that produced the sparseness: "When
    there's no specific feelings it should basically be blank, not explicitly
    neutral." Then, when models over-emitted anyway, forcing the judgment into
    the numbered context scaffold as item 8.
    <br><br>Attitudes are shown to the player only behind the internals toggle.
    They are private state, and reading them in the UI is a debugging affordance,
    not a game one.`,
  },

  {
    section: "The engine",
    title: "The lunch problem",
    body: `${quote(
      `Walk into the café at lunch and everyone is on an attentive schedule, so every character in the room passed the reaction gate and every turn was six overlapping monologues. The gate stays per-character (it computes each person's claim as \`reactionPriority\`); this module is the one place with the global view, deciding who actually gets a slot.`,
      "lib/game/crowd.ts",
    )}
    ${bullets([
      "Priority 3 — spoken to, or the person you are already talking to — is <b>guaranteed and never capped</b>",
      "Everyone else competes for the remaining slots, three per turn",
      "Ties go to whoever has acted least recently, so the bystander slot rotates",
      "Scripted events (ceremonies, triggers, wakeups) pass through uncapped",
    ])}`,
    notes: `The constraint the author gave: "only 2-3 characters can respond in
    a turn," and then, crucially, "If I'm interacting with someone they should
    always get a turn."
    <br><br>That second sentence is what makes the rule a two-stage design
    rather than a cap: a naive top-3 would sometimes drop the person you were
    mid-conversation with, which is the one failure a player would definitely
    notice.`,
  },

  {
    section: "The engine",
    title: "Two kinds of locked door",
    body: `${columns(
      `<h4><code>restriction</code></h4>
      ${para(`Prose. A model adjudicates the attempt.`)}
      ${para(`Right for doors a character can decide to allow — the quarters
      doors, which their owners walk through nightly.`)}`,
      `<h4><code>sealed</code></h4>
      ${para(`A flag. The engine refuses without asking anyone.`)}
      ${para(`<code>pathTo</code> will not route through it, so schedules and
      the cuff do not either. Only an engine-made event opens one.`)}`,
    )}
    ${quote(
      `a model can be argued through prose, and this door's whole point is that nothing the player types opens it.`,
      "lib/game/classes.ts",
    )}`,
    notes: `This came out of a design conversation about a puzzle that needed a
    door nobody could talk their way through. The author's line was the useful
    one: "We can make an exit essentially impossible to get through after all."
    <br><br>There is an eval whose entire job is to try to talk through the
    sealed door and check the player is still standing in the hallway
    afterwards.`,
  },

  {
    section: "The engine",
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
    section: "The apparatus",
    kind: "section",
    body: `${archiveBanner("PART THREE", "THE APPARATUS · how anyone knows it works")}
    ${archivist(
      `Now! ►► The part where they MEASURE things ◄◄ They measure and measure ` +
        `and then they write down that the measurement was wrong. And then ` +
        `they keep BOTH. I find this deeply correct.`,
    )}`,
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
    ${table(
      ["question", "command"],
      [
        ["Did I break the engine?", "<code>pnpm test</code>"],
        ["What does the game feel like?", "<code>pnpm playtest</code>"],
        ["...starting later in the game?", "<code>pnpm playtest --from briefed -i</code>"],
        ["Can this model run the game at all?", "<code>pnpm evals</code>"],
        ["Can a <em>small</em> model handle some prompts?", "<code>pnpm evals --flash &lt;model&gt;</code>"],
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
      `Prose between the blocks explains the intent; the blocks keep it honest.
      ${DOCTESTS} files, and the interesting ones open with a design argument
      before any code.`,
    )}
    ${aside(`►► Documentation that FAILS when it lies. Oh, that is good ◄◄`)}`,
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
    title: "Cassettes: recorded model calls, replayed offline",
    body: `${quote(
      `Keying on the whole prompt means one edit invalidates every entry at once, which looks like fragility and mostly isn't. The alternative — key on less, so small prompt changes keep hitting — sounds better and is worse: the system prompt is where character instructions live, so ignoring part of it means a change that _should_ change the model's behaviour silently replays replies from before it. That trades a loud failure for a quiet wrong answer, on a fixture whose entire job is standing in for a real model.`,
      "playtest/README.md",
    )}
    ${para(
      `So it over-invalidates deliberately, and owes you an obvious failure in
      exchange: a miss prints what is stale and the command to fix it.`,
    )}`,
    notes: `The failure it used to produce instead: "the player has no name",
    "Ama never finished intake" — game-state assertions, which read as a broken
    engine rather than an old recording. That cost a confusing few minutes twice
    in one afternoon.
    <br><br>The corollary is in the README too: keep few cassettes and record
    short scenarios, because the cost of invalidation scales with how much has
    been recorded, not with how much changed. There is exactly one cassette in
    the repo.`,
  },

  {
    section: "The apparatus",
    title: "The one idea most worth stealing",
    body: `${columns(
      `<h4>A cassette is a <em>cache</em></h4>
      ${para(`A stale entry is a wrong answer.`)}
      ${para(`So: over-invalidate, and be loud about it.`)}`,
      `<h4>A result is a <em>record</em></h4>
      ${para(`A stale entry is still a fact.`)}
      ${para(`So: never invalidate, and stamp it with what it measured.`)}`,
    )}
    ${quote(
      `A number measured against an old prompt is still a fact about that prompt, and results are kept, not expired. That's the opposite of how the cassettes treat staleness, and the difference is the point.`,
      "evals/README.md",
    )}`,
    notes: `If the talk has one transferable engineering idea, this is it. Two
    caches of expensive nondeterministic output, in the same repo, given
    deliberately opposite staleness policies, because one is a substitute for a
    computation and the other is evidence about the past.
    <br><br>The same pattern recurs across the project: room art is generated
    offline and regenerated on a prompt-hash diff; checkpoints are recorded live
    and committed; the published pages are generated and committed. The deploy
    never calls a model.`,
  },

  {
    section: "The apparatus",
    title: "Checkpoints, and a fixture that lied",
    body: `${quote(
      `Worth writing for any checkpoint that scenarios resume from. The first recording of \`briefed\` walked into the Foyer's locked door, stopped a room short with the mystery still veiled, and saved perfectly happily; a checkpoint quietly holding the wrong state poisons everything downstream and the failures surface somewhere else entirely.`,
      "playtest/checkpoints.ts",
    )}
    ${code(
      `expect: (model) =>
  model.world.entities.PLAYER.inside === "Hollow_Atrium" &&
  model.world.entities.Ink_And_Echo.state !== "veiled",`,
      "the predicate the recorder refuses to save without",
    )}`,
    notes: `A checkpoint is just a log, so it needs no special serialisation —
    but a YAML file cannot carry a claim about what the state <em>means</em>.
    That is what the predicate is for.
    <br><br>Checkpoints are recorded through live model calls on purpose: "a
    checkpoint reached by a scripted fake would be a state no real game ever
    passes through, and anything resuming from it would be exercising a
    fiction."`,
  },

  {
    section: "The apparatus",
    title: "A fixture can also preserve a bug",
    body: `${quote(
      `Checkpoints are recorded through the same backend the game runs on, so a bug in the backend is written into the saved transcript and replays from then on. That happened: \`cliChat\` appended "respond with ONLY game tags" to \`describe people\`, which asks for sentences, and the model's reply — asking what game tags were — was saved as a room description. Every quest run since started by showing the player the game asking its operator about tag formats.`,
      "test/staleness.doctest.md",
    )}
    ${para(
      `The checkpoint sat on disk for days. Nothing read a checkpoint for
      whether it sounded like an assistant. Now something does: a test scans
      every saved action for phrases like "could you clarify" and "let me know
      if".`,
    )}`,
    notes: `This is a good one to dwell on: the fixture was contaminated by the
    harness, and every downstream measurement inherited it silently. The test
    that now catches it is essentially a smell detector for assistant-voice
    leaking into game data.
    <br><br>Pairs with the CLAUDE.md thesis later: style is transmissible, and
    it transmits through fixtures as well as through prompts.`,
  },

  {
    section: "The apparatus",
    title: "What an eval scores",
    body: `${columns(
      `<h4>Protocol</h4>
      ${para(`Could the engine act on everything the model said?`)}
      ${para(`Measured by capturing the engine's own
      <code>console.warn</code> while it folds the output.`)}`,
      `<h4>Scenario</h4>
      ${para(`Did the game reach the state the scenario aimed at?`)}
      ${para(`The player's name recorded. The player actually in a different
      room. Ama still in character.`)}`,
    )}
    ${quote(
      `Reading the engine's own complaints rather than keeping a list of valid tags here means the eval picks up new failure modes as the engine grows them, instead of drifting out of step with the thing that actually enforces the protocol.`,
      "evals/README.md",
    )}`,
    notes: `The cost of that blanket capture, which bit twice: anything else
    that warns during a scenario is scored as a protocol failure. A backend's
    retry notice was, until it was moved to <code>console.info</code>. So a
    model was briefly being marked down for the network having a bad second.
    <br><br>Rule that came out of it: log from the harness with
    <code>info</code> or <code>error</code>, and keep <code>warn</code> for the
    engine rejecting model output.`,
  },

  {
    section: "The apparatus",
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
    section: "The apparatus",
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
    section: "The apparatus",
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
    section: "The apparatus",
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
    section: "The apparatus",
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
    section: "The apparatus",
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
    section: "The apparatus",
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
    section: "The apparatus",
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
    section: "What it found",
    kind: "section",
    body: `${archiveBanner("PART FOUR", "FINDINGS · what the instrument caught")}
    ${archivist(
      `The BEST records! ►► These are the ones where something went wrong ◄◄ ` +
        `I keep those with particular care. Nobody ever asks for the ones ` +
        `where nothing happened.`,
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
    ${archivist(
      `Oh, they keep a list of what is WRONG with it. ►► In the repository. ` +
        `Where anyone can read it ◄◄ I did not have to be asked twice to file that one.`,
    )}`,
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
    )}
    ${aside(`►► I would simply file everything. Then it is all equally important ◄◄`)}`,
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
    ${archivist(
      `Ohh. ►► This is the part where they talk about ME ◄◄ Well. Not me. ` +
        `Something like me. I am told the distinction matters a great deal.`,
    )}`,
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
    title: "The README has not caught up",
    body: `${quote(
      `Is this generated with AI?

I use Copilot and GPT extensively, but no large chunks are created independently by AI. But much of the game dossier was created in close collaboration with GPT.`,
      "README.md, written 2024, still there today",
    )}
    ${para(
      `Two hundred and fifteen commits later, that paragraph is the most
      out-of-date sentence in the repository.`,
    )}`,
    notes: `Not a gotcha — it is genuinely true of the era it describes, and
    nobody has had a reason to rewrite the FAQ.
    <br><br>But it is a good prompt for the room: what <em>should</em> that
    paragraph say now? The honest answer is complicated, because the next few
    slides are about how much of the work was deciding what the agent was
    allowed to write.`,
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

function renderSlide(slide: Slide, index: number, total: number): string {
  const kind = slide.kind ?? "content";
  const heading = slide.title
    ? `<h2>${COLORS.tint(esc(slide.title))}</h2>`
    : "";
  const notes = slide.notes
    ? `<div class="notes"><b>notes</b>${slide.notes}</div>`
    : `<div class="notes"><b>notes</b><span class="dim">(none)</span></div>`;
  // The first slide carries `shown` in the markup so the deck renders
  // something before (or without) the script.
  return `<section class="slide ${kind}${index === 0 ? " shown" : ""}" id="s${index + 1}" data-n="${index + 1}">
  <div class="frame">
    ${slide.section && kind === "content" ? `<div class="kicker">${esc(slide.section)}</div>` : ""}
    ${heading}
    <div class="content">${slide.body}</div>
  </div>
  ${notes}
  <div class="pagenum">${index + 1} / ${total}</div>
</section>`;
}

function page(): string {
  const total = SLIDES.length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intra — how it was built</title>
<style>${STYLE}${DECK_STYLE}${COLORS.css}</style>
</head>
<body class="deck">
${SLIDES.map((slide, i) => renderSlide(slide, i, total)).join("\n")}
<div class="helpbar" id="helpbar">
  ← → or space: move · <kbd>N</kbd>: notes · <kbd>Home</kbd>/<kbd>End</kbd>: ends · <kbd>?</kbd>: hide this
</div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const DECK_STYLE = `
body.deck { max-width: none; margin: 0; padding: 0; height: 100vh; overflow: hidden; }
.slide { display: none; height: 100vh; padding: 3vh 4vw 6vh; box-sizing: border-box;
         flex-direction: column; overflow: hidden; }
.slide.shown { display: flex; }
.frame { flex: 1; min-height: 0; overflow-y: auto; }
.kicker { text-transform: uppercase; letter-spacing: .12em; font-size: clamp(.6rem, 1.1vw, .8rem);
          color: var(--dim); margin-bottom: .6rem; }
.slide h2 { font-size: clamp(1.3rem, 2.9vw, 2.1rem); margin: 0 0 1.2rem; line-height: 1.15;
            letter-spacing: -.01em; color: var(--fg); }
.slide .content { font-size: clamp(.85rem, 1.45vw, 1.15rem); }
.slide p { max-width: 54em; }
.slide.title { justify-content: center; text-align: center; }
.slide.title .frame { flex: 0 0 auto; }
.slide.section { justify-content: center; }
.slide.section .frame { flex: 0 0 auto; }
.lead { font-size: clamp(1.1rem, 2.2vw, 1.6rem); color: var(--fg); max-width: 40em;
        margin-left: auto; margin-right: auto; }
/* Title and divider slides center their blocks; content slides stay ragged-right.
   The banner is an inline-block, so it centers by text-align rather than by
   auto margins. */
.slide.section .frame { text-align: center; }
.slide.title p, .slide.section p {
  margin-left: auto; margin-right: auto; width: fit-content; max-width: 54em; }
.slide.title .archivist, .slide.section .archivist { text-align: left; }
pre.code { background: #0b1220; border: 1px solid var(--line); border-radius: 6px;
           padding: .8rem 1rem; overflow-x: auto; white-space: pre; margin: .6rem 0;
           font-size: clamp(.62rem, 1.02vw, .88rem); line-height: 1.45; color: #cbd5e1; }
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
.aside { color: #facc15; font-family: ui-monospace, monospace;
         font-size: clamp(.68rem, 1.1vw, .85rem); margin-top: 1.1rem; }
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
body.notes-on .frame { max-height: 60vh; }
/* On a wide screen the notes sit beside the slide instead of under it, so
   turning them on does not squash the content the audience is reading. */
@media (min-width: 62rem) {
  body.notes-on .slide.shown { flex-direction: row; gap: 2rem; }
  body.notes-on .frame { max-height: none; }
  body.notes-on .slide.shown .notes { flex: 0 0 22rem; max-height: none;
    border-top: none; border-left: 2px solid var(--partial); align-self: stretch; }
}
.helpbar { position: fixed; left: 0; right: 0; bottom: 0; text-align: center;
           font-size: .7rem; color: var(--line); padding: .3rem; pointer-events: none; }
.helpbar.hidden { display: none; }
kbd { border: 1px solid var(--line); border-radius: 3px; padding: 0 .25rem;
      font-family: ui-monospace, monospace; font-size: .9em; }
@media print {
  body.deck { height: auto; overflow: visible; }
  .slide { display: flex !important; page-break-after: always; height: auto; min-height: 90vh; }
  .notes { display: block !important; }
  .helpbar { display: none; }
}
`;

const SCRIPT = `
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var current = 0;
  function show(n) {
    current = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, i) { s.classList.toggle('shown', i === current); });
    if (history.replaceState) history.replaceState(null, '', '#' + (current + 1));
    var frame = slides[current].querySelector('.frame');
    if (frame) frame.scrollTop = 0;
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
    else if (k === '?' || k === '/') {
      var bar = document.getElementById('helpbar');
      if (bar) bar.classList.toggle('hidden');
    }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('a') || e.target.closest('.notes')) return;
    show(current + (e.clientX < window.innerWidth * 0.25 ? -1 : 1));
  });
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
`;

writeFileSync(resolve(HERE, "index.html"), page());
console.log(`wrote slides/index.html — ${SLIDES.length} slides`);
