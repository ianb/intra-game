import clone from "just-clone";
import type { TagType } from "../parsetags";
import { isPerson } from "../types";
import type { EntityId, StoryEventType } from "../types";
import {
  coerceBoolean,
  coerceNumber,
  coercePronouns,
  isValidPropertySet,
} from "./coerce";
import { fieldsOf } from "./dynamic";
import { applyTodoTag } from "./todos";
import type { World } from "./world";

/**
 * The LLM tag protocol: turning one tag of a model response into game state.
 *
 * The model replies with tag-shaped text (`<dialog>`, `<set attr="...">`,
 * `<resolveMystery>`, ...) rather than tool calls, and this module is where each
 * of those becomes a change or an action on the story event being built. It is
 * deliberately synchronous and free of the Model/LLM plumbing, so the whole
 * protocol can be exercised directly in tests.
 *
 * Malformed tags are warned about and skipped rather than throwing: the model
 * will get attributes wrong, and one bad tag must not lose the rest of a turn.
 */
export interface TagContext {
  world: World;
  /** The entity whose response this is — the default speaker for dialog. */
  entityId: EntityId;
  /** The room the response is happening in. */
  roomId: EntityId;
  /** For `<description>`: what the player asked to examine, when this was one. */
  subject?: string;
  /**
   * Where a tag reports that it couldn't be used, in words meant for the model.
   *
   * Populated only when the caller supplies an array. What goes in is limited to
   * mistakes a model could plausibly fix if told — a misspelt attribute, a value
   * of the wrong shape — because the point is to hand it back and ask again.
   * Anything the model cannot act on is a warning and stays one.
   */
  complaints?: string[];
}

/**
 * Apply one tag to `event`, mutating it in place.
 *
 * Returns false if the tag isn't part of the base protocol, which means the
 * caller should offer it to the entity's own `processTag` hook (that's how
 * PlayerClass adds `<goto>`, `<examine>`, `<action>` and friends).
 */
export function applyTag(
  tag: TagType,
  event: StoryEventType,
  ctx: TagContext,
): boolean {
  const { world, roomId } = ctx;
  switch (tag.type) {
    case "set":
      applySet(tag, event, ctx);
      return true;

    case "dialog": {
      const id = world.makeId(tag.attrs.character) || ctx.entityId;
      const toId = world.makeId(tag.attrs.to) || undefined;
      const toOther = tag.attrs.speaking || undefined;
      const text = tag.content;
      if (text.trim()) {
        event.actions.push({ type: "dialog", id, toId, toOther, text });
        // FIXME: this is pretty arbitrary time
        event.totalTime += 1 + Math.ceil(text.split(/\s+/).length / 40);
      }
      return true;
    }

    case "description": {
      let minutes = tag.attrs.minutes
        ? coerceNumber(tag.attrs.minutes)
        : undefined;
      if (Number.isNaN(minutes)) {
        console.warn("Could not parse minutes", tag);
        minutes = undefined;
      }
      event.actions.push({
        type: "description",
        text: tag.content,
        minutes,
        subject: ctx.subject,
      });
      event.totalTime += minutes || 0;
      return true;
    }

    case "suggestion":
      event.suggestions = tag.content;
      return true;

    case "todo":
    case "todoDone":
      return applyTodoTag(tag, event, world.todos);

    case "deferSchedule":
      event.deferSchedule = true;
      return true;

    case "leaveNow":
      event.deferSchedule = false;
      return true;

    case "context":
      // Planning output, not action — nothing to apply.
      return true;

    case "attitude": {
      // How the acting character now feels about one person, replacing what
      // they felt before. Empty content clears the feeling: faded is blank,
      // not "neutral". Attribution is forced to the actor, like <mind> — you
      // can change your own feelings, not anyone else's.
      const self = world.getEntity(ctx.entityId);
      const targetId = world.makeId(tag.attrs.toward || "");
      const target = targetId ? world.getEntity(targetId) : undefined;
      if (!self || !isPerson(self)) {
        console.warn("Non-person emitted <attitude>", ctx.entityId);
        return true;
      }
      if (!target || !isPerson(target)) {
        ctx.complaints?.push(
          `<attitude toward="${tag.attrs.toward ?? ""}"> — toward must name a person by id, like toward="PLAYER".`,
        );
        return true;
      }
      const text = tag.content.trim();
      if (!text && self.attitudes[target.id] === undefined) {
        // Clearing a feeling that was never there is a no-op, not an event.
        return true;
      }
      if (!event.changes[ctx.entityId]) {
        event.changes[ctx.entityId] = { before: {}, after: {} };
      }
      const change = event.changes[ctx.entityId]!;
      change.before.attitudes = {
        ...change.before.attitudes,
        [target.id]: self.attitudes[target.id] ?? null,
      };
      change.after.attitudes = {
        ...change.after.attitudes,
        [target.id]: text || null,
      };
      return true;
    }

    case "mind": {
      // A private note of the character's state of mind. Unlike <context> it
      // persists: it lands in the log, and history rendering shows it back to
      // this character (and only this character) on later turns. Always
      // attributed to the entity acting — a character cannot put a thought in
      // someone else's head, so any character= attribute is ignored.
      const text = tag.content.trim();
      if (text) {
        event.actions.push({ type: "mind", id: ctx.entityId, text });
      }
      return true;
    }

    case "removeRestriction": {
      const exitLocation = world.makeId(tag.content);
      const exits = world.getRoom(roomId)!.exits;
      if (!exitLocation || !exits.find((x) => x.roomId === exitLocation)) {
        console.warn("Could not find exit location", tag);
        return true;
      }
      if (!event.changes[roomId]) {
        event.changes[roomId] = { before: {}, after: {} };
      }
      event.changes[roomId]!.before.exits = clone(exits);
      const newExits = clone(exits);
      newExits.find((x) => x.roomId === exitLocation)!.restriction = undefined;
      event.changes[roomId]!.after.exits = newExits;
      return true;
    }

    case "resolveMystery": {
      const mysteryId = world.makeId(tag.attrs.id);
      const mystery = world.getMystery(mysteryId || "");
      if (!mysteryId || !mystery) {
        console.warn("Could not parse mystery id", tag);
        return true;
      }
      if (!event.changes[mysteryId]) {
        event.changes[mysteryId] = { before: {}, after: {} };
      }
      const change = event.changes[mysteryId]!;
      change.before.state = mystery.state;
      change.before.resolution = mystery.resolution;
      change.after.state = "solved";
      change.after.resolution = tag.content;
      event.actions.push({ type: "description", text: tag.content });
      return true;
    }

    case "trigger": {
      const entityId = world.makeId(tag.attrs.character);
      if (entityId) {
        event.triggers = event.triggers || {};
        event.triggers[entityId] = tag.content;
      }
      return true;
    }

    default:
      return false;
  }
}

/**
 * `<set attr="entity.field">value</set>` — the model writing directly to game
 * state. The value is coerced to match the field's existing type, and checked
 * against isValidPropertySet so the model can't write a non-answer.
 */
function applySet(tag: TagType, event: StoryEventType, ctx: TagContext): void {
  if (!tag.attrs.attr) {
    console.warn("Got set tag with no attr", tag);
    return;
  }
  const [maybeId, key] = tag.attrs.attr.split(".");
  if (!maybeId || !key) {
    console.warn(`Malformed set attr ${JSON.stringify(tag.attrs.attr)}`, tag);
    return;
  }
  const id = ctx.world.makeId(maybeId);
  if (id === null) {
    console.warn(`Could not parse id ${maybeId}`, tag);
    return;
  }
  const entity = ctx.world.getEntity(id);
  if (!entity) {
    console.warn(`Set tag for entity ${id} which does not exist`);
    return;
  }
  const value = fieldsOf(entity)[key];
  if (value === undefined) {
    // Applied anyway, as it always has been — some flows do add attributes —
    // but recorded, because the common case is a model inventing a field name.
    ctx.complaints?.push(
      `<set attr="${entity.id}.${key}"> — ${entity.id} has no attribute "${key}".`,
    );
  }
  let content: string | number | boolean = tag.content;
  if (key === "pronouns") {
    content = coercePronouns(tag.content) ?? tag.content;
  }
  if (typeof value === "boolean") {
    content = coerceBoolean(tag.content);
  } else if (typeof value === "number") {
    // "+1" adds; anything else replaces. A counter the model has to set
    // absolutely means telling it the current value and trusting it to add one,
    // which models get wrong — and the failure is silent, because a count that
    // keeps being re-set to 1 never reaches whatever it was counting towards.
    // Only "+N", and only whole numbers: a bare "-2" is far more likely to mean
    // the value minus two, and the digits are bounded because an unbounded
    // group next to an optional one is a backtracking hazard the linter is
    // right about. Nothing counts past a few.
    const increment = /^\+(\d{1,9})$/.exec(String(tag.content).trim());
    content = increment
      ? value + Number(increment[0])
      : coerceNumber(tag.content);
  }
  if (!isValidPropertySet(key, content)) {
    console.warn(
      `Ignoring invalid property set of: ${entity.id}.${key} =`,
      value,
    );
    ctx.complaints?.push(
      `<set attr="${entity.id}.${key}"> — "${String(tag.content).slice(0, 40)}" is not a usable value for ${key}.`,
    );
    return;
  }
  const existing = event.changes[id];
  if (!existing) {
    event.changes[id] = { before: { [key]: value }, after: { [key]: content } };
  } else {
    existing.before[key] = value;
    existing.after[key] = content;
  }
}
