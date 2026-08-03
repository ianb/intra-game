import { isPerson, StoryEventType } from "@/lib/types";
import type { World } from "@/lib/game/world";

/**
 * Declared-meter changes in one event, for the transcript to mark.
 *
 * The in-fiction beat rule asks the character to show a meter move in
 * behavior, but on the characters most likely to carry meters the fiction
 * saturates: an annoyed Milton and a baseline Milton both complain, so the
 * player can't tell a real scored change from flavor. This is the mechanical
 * channel — the same register as the todo lines, the game speaking rather
 * than the character.
 *
 * Only meters declared in `statSpecs` count. Other numeric state (angst,
 * civicPoints) has its own indicators in the fiction, and internal counters
 * are not the player's business.
 */
export interface MeterMove {
  /** Who moved. */
  name: string;
  color: string;
  /** Which meter. */
  meter: string;
  /** Signed step; the UI shows direction, not the value. */
  delta: number;
}

export function meterMoves(update: StoryEventType, world: World): MeterMove[] {
  const moves: MeterMove[] = [];
  for (const [entityId, change] of Object.entries(update.changes)) {
    const entity = world.getEntity(entityId);
    if (!entity || !isPerson(entity)) {
      continue;
    }
    for (const meter of Object.keys(entity.statSpecs)) {
      const before = change.before?.[meter];
      const after = change.after?.[meter];
      if (
        typeof before === "number" &&
        typeof after === "number" &&
        before !== after
      ) {
        moves.push({
          name: entity.name,
          color: entity.color,
          meter,
          delta: after - before,
        });
      }
    }
  }
  return moves;
}
