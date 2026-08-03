import {
  ActionRequestType,
  EntityId,
  isPromptRequest,
  StoryEventType,
} from "../types";
import type { ParametersType } from "./classes";

/**
 * Capping how many characters respond to one player turn.
 *
 * Walk into the café at lunch and everyone is on an attentive schedule, so
 * every character in the room passed the reaction gate and every turn was
 * six overlapping monologues. The gate stays per-character (it computes each
 * person's claim as `reactionPriority`); this module is the one place with
 * the global view, deciding who actually gets a slot.
 *
 * The rules:
 * - Whoever the player is interacting with always gets a turn: priority 3
 *   (spoken to directly, or the player's current interlocutor) is guaranteed
 *   and never capped.
 * - Everyone else competes for the remaining slots, higher priority first.
 * - Ties go to whoever has acted least recently, so the bystander slot
 *   rotates through the crowd instead of the same character always talking
 *   over everyone — turn taking, without a schedule for it.
 * - Scripted requests (mystery triggers, ceremonies, wakeups) carry no
 *   priority and pass through untouched.
 */

/** Total characters that may respond to one player event. */
export const REACTION_CAP = 3;

function priorityOf(request: ActionRequestType): number | undefined {
  if (!isPromptRequest(request)) {
    return undefined;
  }
  return (request.parameters as ParametersType).reactionPriority;
}

export function capReactions(
  actions: ActionRequestType[],
  recentEvents: StoryEventType[],
  cap: number = REACTION_CAP,
): ActionRequestType[] {
  const reactions = actions.filter(
    (action) => priorityOf(action) !== undefined,
  );
  if (reactions.length <= cap) {
    return actions;
  }
  // Where an entity last acted, for the rotation tie-break. -1 = never, which
  // sorts first: someone who has not spoken all game gets the slot.
  const lastActed = (id: EntityId): number => {
    for (let i = recentEvents.length - 1; i >= 0; i--) {
      if (recentEvents[i]!.id === id) {
        return i;
      }
    }
    return -1;
  };
  const guaranteed = reactions.filter((action) => priorityOf(action)! >= 3);
  const rest = reactions
    .filter((action) => priorityOf(action)! < 3)
    .sort(
      (a, b) =>
        priorityOf(b)! - priorityOf(a)! ||
        lastActed((a as { id: EntityId }).id) -
          lastActed((b as { id: EntityId }).id),
    );
  const keep = new Set<ActionRequestType>([
    ...guaranteed,
    ...rest.slice(0, Math.max(0, cap - guaranteed.length)),
  ]);
  return actions.filter(
    (action) => priorityOf(action) === undefined || keep.has(action),
  );
}
