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

const SYSTEM = `You are playing a text adventure game. You are the player.

Each turn you will be shown what just happened, where you are, who is with you,
where you can go, and what is on your list. Reply with exactly one line: the
command or speech you want to try. Nothing else — no explanation, no quotes, no
markdown.

You can type anything. Some examples of the kinds of thing that work:

go to the archive lounge
ask Harold about the poems
look at the desk
tell Marta I know it was her

Play to make progress on your list and the open questions. Talk to people, go
places, and look at things. Don't repeat a command that just failed; try
something else instead.`;

export interface PlayerTurn {
  input: string;
  raw: string;
}

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
  return async function nextCommand(view: PlayerViewType): Promise<PlayerTurn> {
    history.push({ role: "user", content: renderPlayerView(view) });
    const raw = await chat({
      meta: { title: "llm player" },
      messages: [{ role: "system", content: SYSTEM }, ...history.slice(-limit)],
    });
    history.push({ role: "assistant", content: raw });
    return { input: extractCommand(raw), raw };
  };
}
