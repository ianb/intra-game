import type { StoryEventType } from "../types";

/**
 * Undo, without losing the record of it.
 *
 * The update stream is the game's source of truth *and* — once sessions live on
 * a server — its audit trail. So undo must not delete anything: instead it
 * appends an event carrying a `rewind` count, and the events it supersedes are
 * filtered out when the world is folded.
 *
 * That keeps the log append-only (a reviewer can still see what the model
 * produced and that the player took it back), while the game behaves as if
 * those turns never happened.
 */

/**
 * The events still in effect, with rewound spans and the rewind markers
 * themselves removed.
 *
 * A rewind supersedes the N preceding *live* events, so rewinds compose: undoing
 * twice walks back two turns, and a rewind can itself be rewound.
 */
export function applyRewinds(updates: StoryEventType[]): StoryEventType[] {
  const live: StoryEventType[] = [];
  for (const update of updates) {
    if (update.rewind) {
      live.length = Math.max(0, live.length - update.rewind);
      continue;
    }
    live.push(update);
  }
  return live;
}

/**
 * How many trailing live events make up the most recent player turn — the
 * player's input plus everything it caused. Zero if there's no turn to undo.
 */
export function lastTurnLength(live: StoryEventType[]): number {
  for (let i = live.length - 1; i >= 0; i--) {
    if (isUserInput(live[i]!)) {
      return live.length - i;
    }
  }
  return 0;
}

/** A story event that came from the player typing something. */
export function isUserInput(update: StoryEventType): boolean {
  return !!(update.id === "PLAYER" && update.llmParameters?.input);
}
