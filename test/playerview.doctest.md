# What a model playing the game is allowed to see

Letting a model play the game only measures anything if the model can't see the
answer. The engine has it sitting in plain English —
`Ink_And_Echo.revealedHints.Marta` begins "Marta is actually Ink and Echo" — so a
view assembled from world state would produce a confident score that means
nothing at all.

So the view is built from the interface, not the world: story events, the room,
its exits, who is visibly present, the task list, and the *names* of open
mysteries. A name is the question ("Who is writing notes as 'Ink and Echo'?");
the hints are the answer, and they are never read.

```ts setup
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import { playerView, renderPlayerView } from "../evals/playerview.js";
import { extractCommand, llmPlayer, parseReply } from "../evals/llmplayer.js";
import { buildPrompt, GAME_TAG_INSTRUCTION } from "../playtest/clichat.js";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

// A real game, mid-story: the briefed checkpoint has the mystery revealed and
// the player out in the complex, which is the state a quest starts from.
const model = new Model(entities, { chat: async () => "" });
model.replaceLog(parse(readFileSync("playtest/checkpoints/briefed.yaml", "utf8")).events);
const view = playerView(model);
const rendered = renderPlayerView(view);
```

## The answer is not in there

Marta is the poet. Every character who knows something about her carries it in a
hint, and none of that is reachable from the view:

```ts
[
  rendered.includes("Marta is actually"),
  rendered.includes("obscure it from the records"),
  rendered.includes("Yellow Room"),
].join(" ");
=> false false false
```

Neither is anyone else's private knowledge — Ama's steer toward Harold and Lily,
the Archivist's paper requisitions, Gloria's theory:

```ts
[
  rendered.includes("last two people to find notes"),
  rendered.includes("paper requisitions"),
  rendered.includes("suspects the author spends time"),
].join(" ");
=> false false false
```

Nor the machinery: no prompts, no schedules, no entity ids where names belong.

```ts
[
  rendered.includes("roleplayInstructions"),
  rendered.includes("<dialog"),
  rendered.includes("Hollow_Atrium"),
].join(" ");
=> false false false
```

## What it does see

The question, not the answer — reaching it through the list, the same way a
person sees it:

```ts
view.todos.join(" | ");
=> Who is writing notes as 'Ink and Echo'?
```

Where it is, and where it can go — by name, as the interface shows them:

```ts
[view.room.startsWith("The Hollow Atrium"), view.exits.includes("Intake Foyer")].join(" ");
=> true true
```

And the story so far, which is where Ama's briefing lives — the model gets the
premise the way a player does, by having been told it:

```ts
view.transcript.some((line) => line.includes("Ink and Echo"));
=> true
```

## The interface's distinctions survive

The transcript uses colour, indentation and position to say who is speaking and
whether something worked. A model reading flat prose loses all of that and has
to infer the speaker from the writing, which the early quest runs got wrong —
the player mistook a character's terminal-styled dialogue for game output and
echoed it back as a command. So the same distinctions are carried in markup:

```ts
renderPlayerView({
  room: "The Yellow Room: very yellow",
  exits: ["Hallway"],
  people: ["Marta"],
  todos: ["find the poet"],
  done: ["unlock the door"],
  transcript: [
    `[Marta to Ada Quill] "I don't know anything about that."`,
    `[failed] open the cabinet — it is locked`,
    `[list] added: find the poet`,
  ],
}).split("\n").slice(-5).join(" / ");
=> LOCATION  The Yellow Room: very yellow / PEOPLE    Marta / EXITS     Hallway / LIST      find the poet / DONE      unlock the door
```

## Invisible characters stay invisible

Ama is a voice from the ceiling, not someone in the room. The view uses the same
filter the interface does, so she is heard in the transcript and never listed as
present:

```ts
view.people.includes("Ama");
=> false
```

## Reducing a reply to a command

Models narrate even when told not to. A reply that arrives dressed up is a
player who wanted to do the thing, not a protocol failure, so the first line
with content is taken and stripped:

```ts
[
  extractCommand("go north"),
  extractCommand("**ask Harold about the poems**"),
  extractCommand('"look at the desk"'),
  extractCommand("\n\n- talk to Marta"),
].join(" | ");
=> go north | ask Harold about the poems | look at the desk | talk to Marta
```

An empty reply yields nothing rather than a made-up command; the runner stops
rather than inventing a turn the player didn't take:

```ts
JSON.stringify(extractCommand("   \n  \n"));
=> ""
```

## A revealed mystery lands on the list

The task list is the game's "you did it" signal, and until now the story never
used it: the `briefed` checkpoint — Ama handing over the entire Ink and Echo
mystery — recorded no tasks at all, and three full quest playthroughs produced
none between them. A mystery changing state is the clearest concrete progress
the game has, so it now writes to the list, derived in the fold rather than
asked of the model.

```ts
const fresh = new Model(entities, { chat: async () => "" });
fresh.replaceLog(parse(readFileSync("playtest/checkpoints/briefed.yaml", "utf8")).events);
fresh.world.todos.map((t) => `${t.done ? "x" : " "} ${t.title}`).join(" | ");
=>   Who is writing notes as 'Ink and Echo'?
```

Solving it crosses that same task off, rather than adding a second one — the
mystery's name is the id, so the two ends match:

``` continue
const solve = {
  id: "Ama", roomId: "Hollow_Atrium", totalTime: 0, actions: [],
  changes: { Ink_And_Echo: { before: { state: "revealed" }, after: { state: "solved" } } },
};
fresh.world.applyStoryEvent(solve);
fresh.world.todos.map((t) => `${t.done ? "x" : " "} ${t.title}`).join(" | ");
=> x Who is writing notes as 'Ink and Echo'?
```

## The harness must not talk over the player

`cliChat` appends a nudge telling the model to reply with game tags and nothing
else. That is right for the game and wrong for anything else routed through the
same backend — and the LLM player is routed through it, so for five quest runs
the harness ordered the player to abandon its own reply format on every turn.

It noticed. Seventeen SNAG reports in one run, escalating to "this creates an
impossible contradiction". Nobody reading milestone counts would have seen it.

```ts
buildPrompt("say something").endsWith(GAME_TAG_INSTRUCTION);
=> true
```

``` continue
// The player passes "" and gets the conversation alone.
buildPrompt("say something", "");
=> say something
```

## Notes to the reader

Each turn the player writes a short report and gets it back on the next one. It
is addressed to whoever reads the run afterwards, which is true rather than a
framing device: the notes are stored per turn and are the only window into what
the player thought was going on.

That does two jobs. It survives the history window, which a plan otherwise does
not — the first recorded quest spent eleven turns re-interrogating two
characters, having forgotten there were people it had never met. And it gives a
player that is stuck because the game is unfair somewhere to say so, which is
the most valuable thing a quest can produce and something it will only do if
asked. Nothing leaks by keeping them: the notes are the player's own, not the
game's.

```ts
const reply = [
  "NOTES",
  "- Frida says the Archivist has records.",
  "- Not yet met: Harold, Lily.",
  "SNAG",
  "Nothing has told me where any of these people are.",
  "NEXT",
  "go to the archive console",
].join("\n");
const parsed = parseReply(reply);
[parsed.input, parsed.notes?.includes("Not yet met"), parsed.snag].join(" | ");
=> go to the archive console | true | Nothing has told me where any of these people are.
```

The snag is separate from the notes because it is the thing worth aggregating: a
run that stalls usually says why, and collecting those across turns beats
reverse-engineering it from a turn log. Most turns have nothing to report, and
"none" is not a report:

``` continue
const quiet = parseReply("NOTES\n- looking around\nSNAG\nnone\nNEXT\ngo north");
[quiet.snag, quiet.notes].map(String).join(" | ");
=> undefined | - looking around
```

A model that ignores the format has still said what it wants to do, so the
command is taken anyway and the notes are simply left as they were:

```ts
const loose = parseReply("I think I should go and find Harold.\ngo to the foyer");
[loose.input, loose.notes].map(String).join(" | ");
=> I think I should go and find Harold. | undefined
```

## Asking again for a command

The first recorded quest spent 4 of its 20 turns typing "location: Archive
Console" — the player echoing the format of the Archivist's terminal output back
at the game. A thrown-away turn measures nothing about the puzzle, which is what
the quest is for, so a reply that is a label rather than a command gets one
retry. It is also counted, so a weak player still reads as weak rather than
being quietly tidied up.

The rule is deliberately narrow, because a player addressing someone by name
looks similar and must survive:

```ts
const view = { room: "r", exits: [], people: [], todos: [], done: [], transcript: [] };
const replies = ["NEXT\nlocation: Archive Console", "NEXT\ngo to the archive lounge"];
const player = llmPlayer(async () => replies.shift()!);
const turn = await player(view);
[turn.input, turn.fumbled].join(" | ");
=> go to the archive lounge | true
```

``` continue
const speaking = llmPlayer(async () => "NEXT\nMarta: I know it was you");
const said = await speaking(view);
[said.input, said.fumbled].join(" | ");
=> Marta: I know it was you | false
```
