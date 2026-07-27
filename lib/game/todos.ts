import type { StoryEventType, TodoType, TodoUpdateType } from "../types";
import type { TagType } from "../parsetags";

/**
 * The player's task list.
 *
 * The game already told the player what to do next, twice over: `<suggestion>`
 * puts two 2-3 word commands in the composer placeholder, and mysteries name
 * the big unsolved things. Neither holds the middle ground — "Ama wants you to
 * find the missing ficus", "Doug said to come back after lunch" — which is
 * most of what a player is actually carrying around at any moment, and all of
 * which currently lives only in the transcript and the player's head.
 *
 * So: a small, explicit, persistent list. It is state like everything else
 * here, folded out of the event log, which means it survives reload, undo and
 * checkpointing for free, and an LLM playing the game can read its own
 * objectives instead of re-deriving them from a hundred lines of dialog.
 *
 * The tags are deliberately attribute-free — `<todo>text</todo>` and
 * `<todoDone>text</todoDone>`. An earlier design had the model mint and then
 * remember ids; models are bad at that, and every id it got wrong would be a
 * silently lost update. Matching on the text is fuzzy but recoverable, and
 * when it can't be recovered it warns, which the evals count as a protocol
 * failure rather than swallowing.
 */

/** How many open tasks to show a character. Bounds prompt growth. */
export const TODO_PROMPT_LIMIT = 8;

/**
 * A stable key for a task, derived from its text.
 *
 * Only used to recognise the same task said twice — it never has to round-trip
 * back to the model, so it can be as lossy as matching needs.
 */
export function todoId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Find the task some text refers to.
 *
 * Exact slug, then containment either way, so "find the ficus" closes "find the
 * ficus in the atrium". Nothing looser: a fuzzy match ticks off an objective
 * the player never finished, which is worse than the caller warning that it
 * couldn't tell.
 */
export function matchTodo(text: string, todos: TodoType[]): TodoType | null {
  const id = todoId(text);
  if (!id) {
    return null;
  }
  const exact = todos.find((todo) => todo.id === id);
  if (exact) {
    return exact;
  }
  const contained = todos.filter(
    (todo) => todo.id.includes(id) || id.includes(todo.id),
  );
  // Ambiguity is a failure, not a coin flip: two open tasks both plausibly
  // named by the same text means the model hasn't said which one it finished.
  return contained.length === 1 ? contained[0]! : null;
}

/** The tasks this event leaves behind, folded over the ones it started with. */
export function applyTodoUpdates(
  todos: TodoType[],
  storyEvent: StoryEventType,
): TodoType[] {
  const result = todos.map((todo) => ({ ...todo }));
  for (const update of storyEvent.todos || []) {
    const existing = result.find((todo) => todo.id === update.id);
    if (existing) {
      existing.done = update.done;
      if (update.title) {
        existing.title = update.title;
      }
      if (update.from) {
        existing.from = update.from;
      }
    } else {
      result.push({
        id: update.id,
        title: update.title,
        done: update.done,
        ...(update.from ? { from: update.from } : {}),
        by: storyEvent.id,
      });
    }
  }
  return result;
}

/**
 * `<todo>` / `<todoDone>` — the model editing the list.
 *
 * Returns false for tags this doesn't handle, matching the applyTag contract.
 */
export function applyTodoTag(
  tag: TagType,
  event: StoryEventType,
  todos: TodoType[],
): boolean {
  if (tag.type !== "todo" && tag.type !== "todoDone") {
    return false;
  }
  const text = tag.content.trim().replace(/\s+/g, " ");
  const id = todoId(text);
  if (!id) {
    console.warn("Got empty todo tag", tag);
    return true;
  }
  // Tasks added earlier in this same turn count: a character can add a task and
  // complete it in one response, and often should ("I'll unlock it for you").
  const known = applyTodoUpdates(todos, event);
  if (tag.type === "todo") {
    const already = known.find((todo) => todo.id === id);
    if (already && !already.done) {
      // Not a warning. Restating an open task is the model being consistent.
      return true;
    }
    pushUpdate(event, { id, title: text, done: false });
    return true;
  }
  const open = known.filter((todo) => !todo.done);
  const match = matchTodo(text, open);
  if (!match) {
    console.warn(
      `Could not find an open task matching ${JSON.stringify(text)}`,
      open.map((todo) => todo.title),
    );
    return true;
  }
  pushUpdate(event, { id: match.id, title: match.title, done: true });
  return true;
}

function pushUpdate(event: StoryEventType, update: TodoUpdateType): void {
  event.todos = event.todos || [];
  const existing = event.todos.find((todo) => todo.id === update.id);
  if (existing) {
    Object.assign(existing, update);
  } else {
    event.todos.push(update);
  }
}

/**
 * The list as a character sees it, or "" when there's nothing to show.
 *
 * Open tasks only, newest last, capped — a character needs to know what the
 * player is chasing right now, and a finished task is only interesting to the
 * player's own HUD.
 */
export function todoPrompt(todos: TodoType[]): string {
  const open = todos.filter((todo) => !todo.done).slice(-TODO_PROMPT_LIMIT);
  if (!open.length) {
    return "";
  }
  const lines = open.map((todo) => `- ${todo.title}`).join("\n");
  return `PLAYER is currently trying to:\n${lines}`;
}
