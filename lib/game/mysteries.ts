import { Mystery, MYSTERY_STATES, type MysteryTrigger } from "./classes";
import type { ActionRequestType, StoryEventType } from "../types";
import type { World } from "./world";

/**
 * Moving mysteries between states as the game is played.
 *
 * This used to be one `if` inside Ama's onStoryEvent: if the player has just
 * walked into the Hollow Atrium for the first time, reveal Ink and Echo and
 * have her read out its introduction. That worked for one mystery and would
 * have been copied for the second.
 *
 * Worse, it meant three of the four states were unreachable. A mystery could
 * only be `veiled` or `revealed`, so `availableHints` and `solvedHints` — the
 * hint sets for "you could stumble into this" and "everyone knows how it ended"
 * — were declared, dedented on load, passed into prompts, and never once
 * non-empty. The states existed; nothing could enter them.
 */

/** Has this trigger's condition been met, given where the game is now? */
function fired(
  trigger: MysteryTrigger,
  world: World,
  event: StoryEventType,
): boolean {
  if (trigger.enteredRoom !== undefined) {
    const room = world.getRoom(trigger.enteredRoom);
    // The *first* arrival: `visits` is incremented by the same event that moves
    // the player, so a trigger keyed on a room the player revisits would fire
    // every time they walked back in.
    if (
      event.changes.PLAYER?.after?.inside !== trigger.enteredRoom ||
      (room?.visits ?? 0) > 0
    ) {
      return false;
    }
  }
  if (trigger.solved !== undefined) {
    const other = world.getEntity(trigger.solved);
    if (!(other instanceof Mystery) || other.state !== "solved") {
      return false;
    }
  }
  if (trigger.talkedTo !== undefined) {
    const spokenTo = world.model.liveUpdates.value.some((update) =>
      update.actions.some(
        (action) =>
          action.type === "dialog" &&
          (action.id === trigger.talkedTo ||
            ("toId" in action && action.toId === trigger.talkedTo)),
      ),
    );
    if (!spokenTo) {
      return false;
    }
  }
  if (trigger.attrSet !== undefined) {
    const [entityId, attr] = trigger.attrSet.split(".");
    const change = entityId ? event.changes[entityId] : undefined;
    if (
      !attr ||
      !change?.after?.[attr] ||
      // Only the transition. Ama's flags stay true for the rest of the game, so
      // a trigger reading the current value would fire on every later event
      // that happened to mention her.
      change.before?.[attr]
    ) {
      return false;
    }
  }
  if (trigger.turnsPlayed !== undefined) {
    if (world.model.liveUpdates.value.length < trigger.turnsPlayed) {
      return false;
    }
  }
  return true;
}

/** Is `to` further along than `from`? Mysteries never move backwards. */
function advances(from: string, to: string): boolean {
  return (
    MYSTERY_STATES.indexOf(to as never) > MYSTERY_STATES.indexOf(from as never)
  );
}

/**
 * Every state change the world has just earned, as story events.
 *
 * Returned rather than applied, because a state change is part of the log like
 * everything else — the world is a fold over it, so a mystery that advanced
 * without an event would come back veiled on the next reload.
 *
 * A trigger that would move a mystery backwards is ignored rather than
 * rejected: `{ solved: "x", becomes: "available" }` is a reasonable thing to
 * write for a mystery that is *already* revealed by then, and the author
 * shouldn't have to think about the order the player did things in.
 */
export function mysteryTriggers(
  world: World,
  event: StoryEventType,
): ActionRequestType[] {
  const result: ActionRequestType[] = [];
  for (const entity of Object.values(world.entities)) {
    if (!(entity instanceof Mystery)) {
      continue;
    }
    for (const trigger of entity.triggers) {
      if (!advances(entity.state, trigger.becomes)) {
        continue;
      }
      if (!fired(trigger, world, event)) {
        continue;
      }
      const announcer = trigger.announcedBy;
      result.push({
        id: announcer ?? "narrator",
        totalTime: 0,
        roomId: world.entities.PLAYER.inside,
        changes: entity.changes({ state: trigger.becomes }),
        // Silent unless someone announces it. A mystery becoming *available* is
        // usually meant to be invisible — it is the difference between the game
        // being ready to answer a question and the game asking it for you.
        // The narrator narrates; anyone else is a character talking to the
        // player. Ama handing out an errand and the game telling you that you
        // have just noticed something are different acts, and rendering both as
        // dialog would put the second one in quotation marks.
        actions:
          announcer && entity.introduction
            ? [
                announcer === "narrator"
                  ? {
                      type: "description",
                      text: entity.introduction,
                    }
                  : {
                      type: "dialog",
                      id: announcer,
                      toId: "PLAYER",
                      text: entity.introduction,
                    },
              ]
            : [],
      });
      break;
    }
  }
  return result;
}
