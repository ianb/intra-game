# The player's task list

Characters keep a short list of what the player is trying to do, via
`<todo>` and `<todoDone>`. It's ordinary game state: the list is a fold over
the event log, so it survives reload, undo and checkpointing without anything
being serialised specially.

The interesting part is matching, because the model writes a task's text twice —
once to add it, once to cross it off — and never gets to hold onto an id.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { applyTag } from "../lib/game/tags.js";
import { applyTodoUpdates, matchTodo, todoId, todoPrompt } from "../lib/game/todos.js";
import { parseTags } from "../lib/parsetags.js";
import type { StoryEventType, TodoType } from "../lib/types.js";

const world = new Model(entities, { chat: async () => "" }).world;

// Apply a snippet of model output as one turn, and fold it into the list.
function turn(todos: TodoType[], response: string, id = "Ama") {
  const event: StoryEventType = {
    id, roomId: "Intake", totalTime: 0, changes: {}, actions: [],
  };
  world.todos = todos;
  for (const tag of parseTags(response)) {
    applyTag(tag, event, { world, entityId: id, roomId: "Intake" });
  }
  return applyTodoUpdates(todos, event);
}

function titles(todos: TodoType[]) {
  return todos.map((t) => `${t.done ? "x" : " "} ${t.title}`).join(" | ");
}
```

## Adding and finishing

A task is added open, and crossed off by repeating its text:

```ts
let todos = turn([], `<todo>find the missing ficus</todo>`);
titles(todos);
=>   find the missing ficus
```

``` continue
titles(turn(todos, `<todoDone>find the missing ficus</todoDone>`));
=> x find the missing ficus
```

Finished tasks stay on the list — the player wants to see that they did it —
so the fold updates in place rather than removing:

``` continue
turn(todos, `<todoDone>find the missing ficus</todoDone>`).length;
=> 1
```

Who added a task is recorded, since any character may:

```ts
turn([], `<todo>ask Doug about lunch</todo>`, "Doug")[0].by;
=> Doug
```

## Matching is deliberately narrow

The id is derived from the text, so wording that differs only in punctuation or
case still refers to the same task:

```ts
[todoId("Find the missing ficus!"), todoId("find  the missing ficus")].join(" ");
=> find-the-missing-ficus find-the-missing-ficus
```

Containment matches, which covers the model shortening a task on the way back:

```ts
const todos: TodoType[] = [
  { id: todoId("find the ficus in the atrium"), title: "find the ficus in the atrium", done: false, by: "Ama" },
];
matchTodo("find the ficus", todos)!.title;
=> find the ficus in the atrium
```

Nothing looser than that. A different errand doesn't match, and the tag is
dropped with a warning rather than crossing off the wrong thing — a task that
ticks itself off is worse for the player than one that doesn't:

``` continue
matchTodo("water the ficus", todos);
=> null
```

Ambiguity is a failure too. If two open tasks are equally plausible, the model
hasn't said which one it finished. An exact match still wins outright — it's
only ambiguous when nothing matches exactly:

```ts
const todos: TodoType[] = [
  { id: "ask-ama-about-the-door", title: "ask Ama about the door", done: false, by: "Ama" },
  { id: "ask-ama-about-the-vents", title: "ask Ama about the vents", done: false, by: "Ama" },
];
matchTodo("ask Ama about", todos);
=> null
```

Only open tasks are candidates, so re-completing something finished doesn't
match anything:

```ts
let todos = turn([], `<todo>unlock the door</todo>`);
todos = turn(todos, `<todoDone>unlock the door</todoDone>`);
titles(turn(todos, `<todoDone>unlock the door</todoDone>`));
=> x unlock the door
```

## Restating an open task is not an error

Models repeat themselves, and a character bringing up an errand again is
in-character rather than a protocol failure. It's absorbed silently:

```ts
let todos = turn([], `<todo>find the missing ficus</todo>`);
todos = turn(todos, `<todo>Find the missing ficus.</todo>`);
[todos.length, titles(todos)].join(" — ");
=> 1 —   find the missing ficus
```

Adding a task whose text matches a *finished* one reopens that task rather than
making a duplicate. A character saying "you still haven't checked the vents"
means the thing is back on the list, not that there are now two of it:

```ts
let todos = turn([], `<todo>check the vents</todo>`);
todos = turn(todos, `<todoDone>check the vents</todoDone>`);
titles(turn(todos, `<todo>check the vents</todo>`));
=>   check the vents
```

## Adding and finishing in one turn

A character who does the thing themselves ("I'll unlock it for you") writes both
tags in one response, so matching has to see tasks added earlier in the same
event, not just the ones already folded:

```ts
titles(turn([], `<todo>unlock the door</todo>\n<todoDone>unlock the door</todoDone>`));
=> x unlock the door
```

## What characters see

Open tasks only, and capped, so a long game doesn't grow the prompt without
limit. A finished task is only interesting to the player's own display:

```ts
let todos = turn([], `<todo>find the ficus</todo>`);
todos = turn(todos, `<todo>ask Doug about lunch</todo>`);
todos = turn(todos, `<todoDone>find the ficus</todoDone>`);
todoPrompt(todos);
=> PLAYER is currently trying to:
- ask Doug about lunch
```

With nothing open there's no section at all, rather than an empty heading:

```ts
todoPrompt([]);
=>
```
