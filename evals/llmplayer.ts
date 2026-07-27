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
 */

const SYSTEM = `You are the player in a text adventure game. You type one line at
a time and the game responds.

HOW THIS KIND OF GAME WORKS

The world is fixed. There is a set number of rooms, people and things, and they
exist whether or not you have found them. Nothing is generated to suit you and
nothing waits for you to be ready. You make progress by going to places and
talking to people, not by reasoning about what you already know.

Different characters know different things. Asking the same question of two
people gives two different answers, and one of them may be the one that matters.
A character who has nothing to say about one subject may know a great deal about
another.

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
- If you do not know where to go, ask a character where someone is, or what they
  know. Asking for directions is a legitimate move.

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

Reply in exactly this shape, every turn:

NOTES
(your notes for the reader, as above)
NEXT
(one line: the command or speech you want to try, and nothing else)

Example:

NOTES
- Goal: find who writes the Ink and Echo poems. Ama asked me to.
- Frida says the Archivist keeps records. Haven't asked yet.
- Not yet met: Harold, Lily, Gloria, Marta.
- Not yet visited: Static Garden, Activity Hub.
- Trying the Archivist first, then tracking down Harold and Lily.
- Note for the reader: nothing so far has told me where anyone is. I am
  guessing at rooms.
NEXT
go to the archive console
`;

export interface PlayerTurn {
  input: string;
  raw: string;
  /** The player's notebook after this turn; see parseReply. */
  notes: string;
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
export function parseReply(raw: string): { notes?: string; input: string } {
  const lines = raw.split("\n");
  const nextAt = lines.findIndex((line) => /^\s*NEXT\s*:?\s*$/i.test(line));
  if (nextAt === -1) {
    return { input: extractCommand(raw) };
  }
  const notesAt = lines.findIndex((line) => /^\s*NOTES\s*:?\s*$/i.test(line));
  const notes =
    notesAt !== -1 && notesAt < nextAt
      ? lines
          .slice(notesAt + 1, nextAt)
          .join("\n")
          .trim()
      : undefined;
  return {
    ...(notes ? { notes } : {}),
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
    return { input: parsed.input, raw, notes, fumbled };
  };
}
