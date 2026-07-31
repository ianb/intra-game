import { Mystery, MYSTERY_STATES, type MysteryTrigger } from "./classes";
import type { ActionRequestType, StoryEventType } from "../types";
import type { World } from "./world";
import { fieldsOf } from "./dynamic";

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

/**
 * Is this trigger's condition true of the world as it stands?
 *
 * Separate from `fired` because two of the conditions are edge-triggered during
 * play — walking into a room, an attribute becoming true — and neither leaves a
 * flag saying "this happened". Asking after the fact is a different question:
 * has the player *been* to that room, is that attribute true *now*.
 */
function satisfied(trigger: MysteryTrigger, world: World): boolean {
  if (
    trigger.enteredRoom !== undefined &&
    (world.getRoom(trigger.enteredRoom)?.visits ?? 0) === 0
  ) {
    return false;
  }
  if (trigger.solved !== undefined) {
    const other = world.getEntity(trigger.solved);
    if (!(other instanceof Mystery) || other.state !== "solved") {
      return false;
    }
  }
  if (trigger.talkedTo !== undefined && !hasSpokenTo(world, trigger.talkedTo)) {
    return false;
  }
  if (
    trigger.turnsPlayed !== undefined &&
    world.model.liveUpdates.value.length < trigger.turnsPlayed
  ) {
    return false;
  }
  if (trigger.attrSet !== undefined) {
    const [entityId, attr] = trigger.attrSet.split(".");
    const entity = entityId ? world.getEntity(entityId) : undefined;
    if (!attr || !entity || !fieldsOf(entity)[attr]) {
      return false;
    }
  }
  return true;
}

function hasSpokenTo(world: World, who: string): boolean {
  return world.model.liveUpdates.value.some((update) =>
    update.actions.some(
      (action) =>
        action.type === "dialog" &&
        (action.id === who || ("toId" in action && action.toId === who)),
    ),
  );
}

/**
 * Every state change a log has earned but never recorded, silently.
 *
 * A checkpoint is a log and the world is a fold over it, so replaying one does
 * not re-run triggers — they fire during play and append events. That means a
 * mystery added after a checkpoint was recorded is invisible in it forever: the
 * `briefed` checkpoint has `Ama.sharedPlayerAge` true in its log and no
 * where-and-when event, because the mystery did not exist on the day it was
 * recorded. Every eval forked from it would have scored a mystery that was
 * still veiled, with none of its hints in any prompt, and passed.
 *
 * Silent even where the trigger names an announcer. Someone arriving into a
 * game already in progress should not be read an introduction to something that
 * supposedly happened to them weeks ago.
 */
export function catchUpMysteries(world: World): StoryEventType[] {
  const result: StoryEventType[] = [];
  for (const entity of Object.values(world.entities)) {
    if (!(entity instanceof Mystery)) {
      continue;
    }
    for (const trigger of entity.triggers) {
      if (!advances(entity.state, trigger.becomes)) {
        continue;
      }
      if (!satisfied(trigger, world)) {
        continue;
      }
      result.push({
        id: "narrator",
        totalTime: 0,
        roomId: world.entities.PLAYER.inside,
        changes: entity.changes({ state: trigger.becomes }),
        actions: [],
      });
      break;
    }
  }
  return result;
}

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
  if (trigger.talkedTo !== undefined && !hasSpokenTo(world, trigger.talkedTo)) {
    return false;
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
