/**
 * Reading logs written by older versions of the game.
 *
 * Anything here is a one-way fixup applied when a log is loaded, never on the
 * way out — the stored bytes stay as they were recorded.
 */

import {
  isStoryDescription,
  isStoryDialog,
  type EntityId,
  type StoryEventType,
} from "../types";

/** The player's entity id before it became the PLAYER marker. */
const OLD_PLAYER_ID = "player";

/**
 * Rewrite the old player id in a log recorded before the rename.
 *
 * The log is the game — a save, or a server-side session, is just its events —
 * so a log written when the player's id was "player" refers to an entity that
 * no longer exists, and would fold into a world where the player never moved or
 * spoke. Cheap enough to apply on load, and a no-op for anything newer.
 */
export function migratePlayerId(updates: StoryEventType[]): StoryEventType[] {
  const id = (value: EntityId) => (value === OLD_PLAYER_ID ? "PLAYER" : value);
  const keys = <T>(record: Record<EntityId, T>): Record<EntityId, T> =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [id(key), value]),
    );
  return updates.map((update) => ({
    ...update,
    id: id(update.id),
    changes: keys(update.changes),
    triggers: update.triggers && keys(update.triggers),
    actions: update.actions.map((action) => {
      if (isStoryDialog(action)) {
        return {
          ...action,
          id: id(action.id),
          toId: action.toId && id(action.toId),
        };
      }
      // A description has no speaker; everything else is attributed.
      return isStoryDescription(action)
        ? action
        : { ...action, id: id(action.id) };
    }),
  }));
}
