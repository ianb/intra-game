import { renderPlayerView, type PlayerViewType } from "./playerview";
import type { ChatFn } from "../lib/game/model";
import type { MessageType } from "../lib/types";

/**
 * A model playing the game as the player.
 *
 * Every other eval here scores whether a model can *run* the game — speak the
 * tag protocol, stay in character, move the world. This asks the opposite
 * question: whether the game can be played at all by someone who isn't the
 * author. Puzzles are hand-authored and pass/fail, and the person who wrote one
 * cannot tell whether it is solvable or merely solved-in-hindsight.
 *
 * The player sees exactly what the interface shows (see playerview.ts) and
 * types one line at a time, the way a person does. Its own commands are
 * assistant turns and the game's responses are user turns, which is the shape
 * the model is best at.
 *
 * Two different kinds of knowledge, and only one of them is cheating.
 *
 * The player is told that the characters are LLM-played, that plain sentences
 * work, and that the world underneath is authored state. That is the medium,
 * and a human arrives already knowing it — anyone opening this game knows what
 * it is. Withholding it doesn't make the test more honest, it just makes the
 * player waste turns on parser syntax that was never the puzzle.
 *
 * What it must never have is the content: who did it, what a character is
 * privately instructed to say, where the evidence is. That lives in the world
 * and the prompts, and playerview.ts is where the line is enforced.
 */

const SYSTEM = `You are the player in a text adventure game. You type one line at
a time and the game responds.

HOW THIS KIND OF GAME WORKS

The characters are played by a language model, and so is the narration. Human
players know this coming in, so you should too. It means you can talk in plain
sentences and be understood — no parser syntax, no guessing at verbs, no "N" or
"GET LAMP". Say what you want to do or say, the way you would to a person.

Underneath the improvisation the world is fixed. There is a set number of rooms,
people and things, and they exist whether or not you have found them. Who is
where, what has happened and what is true are real state, not invented to suit
you. A character cannot tell you something the game has not given them, and
cannot open a door that is not there. So: freedom in how you say things,
constraint in what turns out to be true.

Different characters know different things. Asking the same question of two
people gives two different answers, and one of them may be the one that matters.
A character who has nothing to say about one subject may know a great deal about
another.

Because they are played rather than scripted, characters have manner as well as
information. Someone being evasive, rude or theatrical is usually
characterisation, not a wall — it may mean you have touched something, or it may
just be who they are. Pushing is fair. So is coming back later.

When someone mentions a name, a place, or an object, that is a lead. Leads are
the main way the game tells you where to go next.

You cannot deduce your way to the end. If you find yourself reasoning about
evidence instead of collecting more of it, go somewhere new.

HOW TO PLAY WELL

Your goal is whatever is on your list and in the open questions. Work toward it
deliberately.

- Prefer a person you have not met or a room you have not entered over asking
  someone who has already answered.
- If two turns in a row taught you nothing new, change location.
- Track who you have not met yet and where you have not been. Go there.
- Ask specific people about specific things: "ask Harold about the poems" beats
  "ask about poems".
- Someone unhelpful earlier may help once you know more. Coming back later with
  a new name or fact is a real move.
- Do not accuse anyone or announce a conclusion until more than one source
  points the same way.
- When you do not know where someone or something is, use /nav (below). Ask
  characters what they know, not where things are — they answer from memory and
  will confidently send you to rooms that do not exist.

FINDING PEOPLE AND ROOMS

You wear a cuff. Every citizen does. It finds things — type "/nav" and a room or
a person:

  /nav Marta
  /nav Archive Console

It shows where they are and the rooms to walk through to get there, and it is
never wrong, because it reads the map rather than remembering it. Characters
describing a route are doing it from memory and will confidently send you to
rooms that do not exist.

It is a computer, not a person: it does not answer questions, cannot be asked
anything else, and using it is free. Use it whenever you are not certain where
someone is. Some rooms are private and it will not route to them, and someone it
cannot find is somewhere you cannot follow.

WHO IS READING THIS

You are playtesting the game for someone who wants to find out whether it can be
played at all. They will read your notes after the run. They cannot see your
reasoning any other way, so your notes are how you talk to them.

Two things follow from that.

Write the notes for that reader. What you have worked out, what you are trying
next and why, who you still haven't met, where you still haven't been. And say
when something seems broken, unfair, or impossible to guess: a dead end, a
character who won't answer, an obvious action the game ignored, a goal you can't
find any way to make progress on. If you are stuck, say you are stuck and say
what you would have needed to know. That is more useful to the reader than a run
that pretends to go well.

The notes are also the only thing you carry between turns. Everything else
scrolls away. So write down anything you will need later, and rewrite them each
turn rather than assuming you will remember.

YOUR REPLY

Reply in exactly this shape, every turn. All three parts, every time.

NOTES
(what you have worked out, what you are trying next, who you have not met, where
you have not been)
SNAG
(anything this turn that seemed broken, unfair, or impossible to guess — a dead
end, a character who would not answer, an obvious action the game ignored, text
that looked like a mistake. Write "none" if there was nothing.)
NEXT
(one line: the command or speech you want to try, and nothing else)

Example:

NOTES
- Goal: find who writes the Ink and Echo poems. Ama asked me to.
- Frida says the Archivist keeps records. Haven't asked yet.
- Not yet met: Harold, Lily, Gloria, Marta.
- Not yet visited: Static Garden, Activity Hub.
- Trying the Archivist first, then tracking down Harold and Lily.
SNAG
Nothing has told me where any of these people are. I am guessing at rooms.
NEXT
go to the archive console
`;

export interface PlayerTurn {
  input: string;
  raw: string;
  /** The player's notebook after this turn; see parseReply. */
  notes: string;
  /** Something the player thought was broken or unguessable this turn. */
  snag?: string;
  /** True when the first reply wasn't a command and had to be asked for again. */
  fumbled: boolean;
}

/**
 * Split a reply into the player's notes and the command.
 *
 * The notes do two jobs, and the framing that makes both work is that they are
 * addressed to the person reading the run afterwards. That is literally true —
 * they are stored per turn in the quest result and are the only window into what
 * the player thought was happening — and it asks the model to do something it is
 * already inclined to do: explain itself to an audience.
 *
 * The first job is memory. A model holds a plan for as long as the plan is in
 * its context, and twenty turns of transcript push it out; the first recorded
 * quest spent eleven turns re-interrogating two characters, having forgotten
 * there were people it had never met. The notes survive the history window.
 *
 * The second is playtest feedback. A player who is stuck because the game is
 * unfair, rather than because it played badly, is the most valuable thing a
 * quest can produce, and it can only say so if asked. Nothing leaks by keeping
 * the notes: they are the player's own, not the game's.
 *
 * Tolerant of a model that ignores the format, because one that does has still
 * told us what it wants to do.
 */
export function parseReply(raw: string): {
  notes?: string;
  snag?: string;
  input: string;
} {
  const lines = raw.split("\n");
  // A section header: the word alone on a line, optionally with a colon.
  const at = (word: string) =>
    lines.findIndex(
      (line) => line.trim().replace(/:$/, "").toUpperCase() === word,
    );
  const nextAt = at("NEXT");
  if (nextAt === -1) {
    return { input: extractCommand(raw) };
  }
  const notesAt = at("NOTES");
  const snagAt = at("SNAG");
  const between = (from: number, to: number) =>
    from === -1 || from >= to
      ? undefined
      : lines
          .slice(from + 1, to)
          .join("\n")
          .trim() || undefined;

  const notes = between(notesAt, snagAt === -1 ? nextAt : snagAt);
  const snagText = between(snagAt, nextAt);
  // "none" is the overwhelmingly common answer and is not a report.
  const snag =
    snagText && !/^(none|n\/a|nothing)\b\.?$/i.test(snagText.trim())
      ? snagText
      : undefined;
  return {
    ...(notes ? { notes } : {}),
    ...(snag ? { snag } : {}),
    input: extractCommand(lines.slice(nextAt + 1).join("\n")),
  };
}

/**
 * Replies that are a label rather than a command.
 *
 * Observed rather than imagined: in the first recorded quest the player spent 4
 * of its 20 turns typing "location: Archive Console", echoing the format of the
 * Archivist's terminal output back at the game. A turn thrown away like that
 * measures nothing about the puzzle, which is the thing being measured, so it's
 * worth one retry — and worth counting, so a weak player still shows as weak.
 *
 * Deliberately narrow. "Marta: I know it was you" is a player talking, and a
 * looser rule would eat it.
 */
const NOT_A_COMMAND = /^(location|position|room|status|inventory|exits)\s*:/i;

/**
 * Reduce a model's reply to the one line the game can take.
 *
 * Models narrate even when told not to, so this takes the first line with
 * content and strips the decoration. A reply that arrives as `**go north**` is
 * a player who wanted to go north, not a protocol failure.
 */
export function extractCommand(raw: string): string {
  for (const line of raw.split("\n")) {
    const cleaned = line
      .trim()
      .replace(/^[-*>\s]+/, "")
      .replace(/^\*\*|\*\*$/g, "")
      .replace(/^`|`$/g, "")
      .replace(/^["']|["']$/g, "")
      .trim();
    if (cleaned) {
      return cleaned;
    }
  }
  return "";
}

/**
 * A player that remembers the game so far.
 *
 * The history is kept rather than re-derived so the model can notice it has
 * already asked Harold about the poems. A player with no memory wanders, which
 * would tell us about the harness rather than about the puzzle.
 */
export function llmPlayer(chat: ChatFn, options: { limit?: number } = {}) {
  const history: MessageType[] = [];
  const limit = options.limit ?? 30;
  // Survives the history window, which is the whole reason it exists.
  let notes = "";
  async function ask(): Promise<string> {
    return chat({
      meta: { title: "llm player" },
      messages: [{ role: "system", content: SYSTEM }, ...history.slice(-limit)],
    });
  }
  return async function nextCommand(view: PlayerViewType): Promise<PlayerTurn> {
    const seen = renderPlayerView(view);
    history.push({
      role: "user",
      content: notes ? `Your notes:\n${notes}\n\n${seen}` : seen,
    });
    let raw = await ask();
    let parsed = parseReply(raw);
    let fumbled = false;
    if (NOT_A_COMMAND.test(parsed.input) || !parsed.input) {
      fumbled = true;
      history.push({ role: "assistant", content: raw });
      history.push({
        role: "user",
        content:
          "That was not a command. Reply with your NOTES, then a NEXT line " +
          "holding one command, like `go to the archive lounge` or " +
          "`ask Frida about the poems`.",
      });
      raw = await ask();
      parsed = parseReply(raw);
    }
    history.push({ role: "assistant", content: raw });
    if (parsed.notes) {
      notes = parsed.notes;
    }
    return {
      input: parsed.input,
      raw,
      notes,
      ...(parsed.snag ? { snag: parsed.snag } : {}),
      fumbled,
    };
  };
}
