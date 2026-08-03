import { tmpl } from "../template";
import {
  ChangesType,
  EntityId,
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
  isStoryMind,
  MessageType,
  StoryEventType,
  StoryEventWithPositionsType,
} from "../types";
import type { World } from "./world";

/**
 * What a character has witnessed, rendered as LLM chat messages.
 *
 * The world is an append-only stream of story events, but no character sees all
 * of it: each event happened in some room, and a character only witnessed it if
 * they were in that room at the time. This module turns that stream into the
 * history for one particular character — which is what lets an NPC be prompted
 * with only what they could actually know.
 *
 * It needs very little of an entity, so it asks for only that (any `Entity`
 * satisfies it) rather than depending on the class hierarchy.
 */
export interface HistoryViewer {
  id: EntityId;
  name: string;
  world: World;
}

/**
 * The events this character witnessed, oldest first.
 *
 * An event is witnessed if the character was in the room where it happened.
 * Global movement bookkeeping (narrator events in "Void") is special-cased: it
 * isn't witnessed wholesale, but the arrivals and departures from the room the
 * character was standing in are.
 */
export function updatesSeenBy(viewer: HistoryViewer): StoryEventType[] {
  const results: StoryEventType[] = [];
  for (const eventPos of viewer.world.model.updatesWithPositions.value) {
    if (eventPos.event.uiOnly) {
      // Interface messages (command usage hints); in the transcript, never
      // in a prompt.
      continue;
    }
    if (eventPos.event.id === "narrator" && eventPos.event.roomId === "Void") {
      results.push(
        ...movementUpdatesForPosition(
          eventPos,
          eventPos.positions.get(viewer.id),
        ),
      );
    }
    if (eventPos.positions.get(viewer.id) === eventPos.event.roomId) {
      results.push(eventPos.event);
    }
  }
  return results;
}

/**
 * Narrow a global movement event down to the moves visible from `position` —
 * i.e. people arriving at or leaving the room the character is standing in.
 */
export function movementUpdatesForPosition(
  eventPos: StoryEventWithPositionsType,
  position: EntityId | undefined,
): StoryEventType[] {
  const changes: ChangesType = {};
  if (!position) {
    return [];
  }
  for (const [entityId, change] of Object.entries(eventPos.event.changes)) {
    if (change.before.inside === position || change.after.inside === position) {
      changes[entityId] = {
        before: change.before,
        after: change.after,
      };
    }
  }
  if (Object.keys(changes)) {
    return [
      {
        ...eventPos.event,
        roomId: position,
        changes,
      },
    ];
  }
  return [];
}

/**
 * Render one witnessed event as chat messages, from this character's
 * perspective: a room heading when the scene changes, bracketed notes for
 * comings and goings, and the event's dialog/description/action tags.
 *
 * The player's own events become "user" messages and everything else
 * "assistant" messages, so the LLM sees the story as a conversation.
 */
export function updateToHistory(
  viewer: HistoryViewer,
  update: StoryEventType,
  { lastUpdate }: { lastUpdate?: StoryEventType },
): MessageType[] {
  const parts: string[] = [];
  if (!lastUpdate || lastUpdate.roomId !== update.roomId) {
    const thisRoom = viewer.world.getRoom(update.roomId);
    if (thisRoom && thisRoom.id !== "Void") {
      parts.push(
        tmpl`
        [The following events occur in room ${thisRoom.id}]
        `,
      );
    }
  }
  for (const [entityId, changes] of Object.entries(update.changes)) {
    if (entityId === viewer.id) {
      if (changes.after.inside) {
        parts.push(tmpl`
          [${viewer.name} goes from ${changes.before.inside} to ${changes.after.inside}]
          `);
      }
      continue;
    }
    if (changes.after.inside && changes.after.inside === update.roomId) {
      parts.push(
        tmpl`
        [${viewer.world.getEntity(entityId)?.name} arrives from ${changes.before.inside}]
        `,
      );
    } else if (
      changes.before.inside &&
      changes.before.inside === update.roomId
    ) {
      parts.push(
        tmpl`
        [${viewer.world.getEntity(entityId)?.name} leaves to ${changes.after.inside}]
        `,
      );
    }
  }
  for (const action of update.actions) {
    if (isStoryDialog(action)) {
      // This removes emoji. While we allow the LLM to create emoji, if it *sees* emoji then it'll use them more and more in a feedback cycle. So by remove them we don't encourage the LLM to use emoji unless it is directly inspired to do so
      // I have a build problem keeping me from using the proper regex: /\p{Emoji}/gu

      const text = action.text.replace(
        // surrogate ranges is intentional (see the note above); switching to a
        // /u-flag \p{Emoji} class would change which characters are stripped, and
        // with them the prompt text that recorded cassettes are keyed on.
        // eslint-disable-next-line no-misleading-character-class -- matching raw
        /[\uD83C-\uDBFF\uDC00-\uDFFF]+|[\u2600-\u26FF\u2700-\u27BF]/g,
        "",
      );
      parts.push(tmpl`
        <dialog character="${action.id}"[[ to="${action.toId}"]]>
        ${text}
        </dialog>
        `);
    } else if (isStoryDescription(action)) {
      const minutes =
        action.minutes === undefined ? "" : ` minutes="${action.minutes}"`;
      const text = action.text.trim().includes("\n")
        ? `\n${action.text.trim()}\n`
        : action.text.trim();
      parts.push(`<description${minutes}>${text}</description>`);
    } else if (isStoryActionAttempt(action)) {
      const minutes = action.minutes ? ` minutes="${action.minutes}"` : "";
      parts.push(tmpl`
      <action success="${action.success ? "true" : "false"}"${minutes}>
      ${action.attempt}

      Result: ${action.resolution}
      </action>
      `);
    } else if (isStoryMind(action)) {
      // Private to the character who had it: their own history shows it back
      // to them, and it is silently absent from everyone else's.
      if (action.id === viewer.id) {
        parts.push(`<mind>${action.text.trim()}</mind>`);
      }
    } else {
      console.warn("Unknown action type", action);
    }
  }
  if (!parts.length) {
    return [];
  }
  return [
    {
      role: update.id === "PLAYER" ? "user" : "assistant",
      content: parts.join("\n\n"),
    },
  ];
}

/**
 * The character's recent history as chat messages, oldest first.
 *
 * Walks backwards from the most recent witnessed event until `limit` messages
 * have accumulated, so a prompt carries the most recent context. Consecutive
 * messages from the same role are folded together, because chat APIs expect
 * alternating roles.
 */
export function historyForEntity(
  viewer: HistoryViewer,
  { limit }: { limit?: number } = {},
): MessageType[] {
  let history: MessageType[] = [];
  const updates = updatesSeenBy(viewer);
  while (!limit || history.length < limit) {
    const update = updates.pop();
    if (!update) {
      break;
    }
    // If we expect this to be the last update included in history, don't act like there's any previous update:
    const lastUpdate =
      limit && history.length + 1 >= limit
        ? undefined
        : updates[updates.length - 1];
    history.unshift(...updateToHistory(viewer, update, { lastUpdate }));
    history = foldHistory(history);
  }
  return history;
}

/** Merge adjacent same-role messages so roles alternate. */
function foldHistory(history: MessageType[]): MessageType[] {
  let found = false;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]!;
    const curr = history[i]!;
    if (prev.role === curr.role) {
      found = true;
      break;
    }
  }
  if (!found) {
    return history;
  }
  const newHistory: MessageType[] = [];
  for (let i = 0; i < history.length; i++) {
    const item = history[i]!;
    const existing = newHistory.at(-1);
    if (!existing || existing.role !== item.role) {
      newHistory.push(item);
      continue;
    }
    newHistory[newHistory.length - 1] = combineHistory(existing, item);
  }
  return newHistory;
}

function combineHistory(a: MessageType, b: MessageType) {
  if (a.content && b.content) {
    if (b.content.includes(a.content)) {
      return b;
    } else if (a.content.includes(b.content)) {
      return a;
    }
    return {
      role: a.role,
      content: a.content + "\n\n" + b.content,
    };
  }
  if (a.content) {
    return a;
  }
  return b;
}
