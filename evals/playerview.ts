import {
  isPerson,
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
} from "../lib/types";
import type { Model } from "../lib/game/model";
import type { StoryEventType } from "../lib/types";

/**
 * Everything a player can see, and nothing else.
 *
 * This is the load-bearing part of letting a model play the game. The engine
 * has the answer sitting right there — `Ink_And_Echo.revealedHints.Marta` says
 * in plain English who the poet is — so a view built from world state would
 * make the whole exercise meaningless while still producing a number that looks
 * like a score.
 *
 * So this is built only from what the interface actually shows: the story
 * events (dialogue, descriptions, action outcomes), the room and its exits, who
 * is visibly present, the task list, and the *names* of revealed mysteries. A
 * mystery's name is the question ("Who is writing notes as 'Ink and Echo'?"),
 * never its hints. Nothing here reads a hint, a schedule, a character's
 * instructions, or any prompt.
 *
 * test/playerview.doctest.md asserts that, by looking for the answer in the
 * rendered view.
 */

export interface PlayerViewType {
  room: string;
  exits: string[];
  people: string[];
  todos: string[];
  mysteries: string[];
  /** What happened since the player last looked. */
  transcript: string[];
}

/** Render one event the way the transcript shows it. */
function renderEvent(model: Model, event: StoryEventType): string[] {
  const nameFor = (id: string) => model.world.getEntity(id)?.name ?? id;
  const lines: string[] = [];
  for (const action of event.actions) {
    if (isStoryDialog(action)) {
      const to = action.toId ? ` (to ${nameFor(action.toId)})` : "";
      lines.push(`${nameFor(action.id)}${to}: "${action.text.trim()}"`);
    } else if (isStoryDescription(action)) {
      lines.push(action.text.trim());
    } else if (isStoryActionAttempt(action)) {
      lines.push(
        `${action.success ? "You" : "You try to"} ${action.attempt.trim()} — ${action.resolution.trim()}`,
      );
    }
  }
  for (const todo of event.todos || []) {
    lines.push(
      todo.done
        ? `[crossed off your list: ${todo.title}]`
        : `[added to your list: ${todo.title}]`,
    );
  }
  return lines;
}

export function playerView(model: Model, since = 0): PlayerViewType {
  const world = model.world;
  const room = world.entityRoom("PLAYER");
  return {
    room: `${room.name}: ${room.shortDescription.trim()}`,
    // Same as the interface: the exit's own name if it has one, otherwise the
    // room's, with a marker for the ones that are locked.
    exits: room.exits.map((exit) => {
      const name =
        exit.name || world.getEntity(exit.roomId)?.name || exit.roomId;
      return exit.restriction ? `${name} (locked)` : name;
    }),
    // Same filter the UI uses: Ama is invisible and is heard, not seen.
    people: world
      .entitiesInRoom(room)
      .filter(isPerson)
      .filter((person) => !person.invisible && person.id !== "PLAYER")
      .map((person) => person.name),
    todos: world.todos.filter((todo) => !todo.done).map((todo) => todo.title),
    // Names only. The name is the question; the hints are the answer.
    mysteries: world
      .unveiledMysteries()
      .filter((mystery) => mystery.state !== "solved")
      .map((mystery) => mystery.name),
    transcript: model.updates.value
      .slice(since)
      .flatMap((event) => renderEvent(model, event)),
  };
}

/** The view as the text a player-model is given. */
export function renderPlayerView(view: PlayerViewType): string {
  const parts: string[] = [];
  if (view.transcript.length) {
    parts.push(view.transcript.join("\n\n"));
  }
  parts.push(`You are in ${view.room}`);
  if (view.people.length) {
    parts.push(`People here: ${view.people.join(", ")}`);
  } else {
    parts.push("Nobody else is here.");
  }
  parts.push(`You can go to: ${view.exits.join(", ") || "(nowhere)"}`);
  if (view.todos.length) {
    parts.push(`Your list:\n${view.todos.map((t) => `- ${t}`).join("\n")}`);
  }
  if (view.mysteries.length) {
    parts.push(
      `Open questions:\n${view.mysteries.map((m) => `- ${m}`).join("\n")}`,
    );
  }
  return parts.join("\n\n");
}
