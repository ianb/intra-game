# TODO

A mini issue tracker. Not a roadmap — nothing here is promised, and the order
inside a section means nothing.

**How to use it.** Items live under **Now**, **Next**, or **Backlog**, and move
up when someone decides to do them. Each item is one bullet:

```
- **Title** `area` `size` — why it matters, and what "done" would look like.
```

`area` is one of `engine` `content` `ui` `tooling` `infra`. `size` is `S` (an
afternoon), `M` (a few days), `L` (a project). Add `blocked:<what>` when it
can't start. Delete finished items rather than accumulating a Done section —
git remembers.

Sources: the [further directions and
criticisms](https://ianbicking.org/blog/2025/07/intra-llm-text-adventure) in the
original write-up, plus whatever the last few sessions turned up.

---

## Now

- **Finish the Cloudflare setup** `infra` `M` `blocked:account-setup` — the
  deployment path is written and dry-run clean but has never run against real
  Cloudflare. Follow [docs/deploying.md](docs/deploying.md): Workers Builds, AI
  Gateway, the API token, the Access application. Done when a push deploys and
  the deployed game is playable behind Access.
- **Exercise the AI Gateway path for real** `infra` `S` `blocked:account-setup`
  — the worker's gateway client is only covered by unit tests. One real
  round-trip would confirm the `provider/model` ids and the
  `cf-aig-authorization` header.
- **Publish the callback-box dev deps** `tooling` `S` — `agent-doctest` and
  `personal-vibe-check` are `file:` dependencies pointing outside the repo.
  `pnpm install --prod` skips them so the Cloudflare builder is fine, but nobody
  else can run the test suite.

## Next

- **An LLM plays the game** `tooling` `L` — an eval where the model is the
  _player_, not the narrator: give it the room description and its task list,
  let it type, and score whether it solves the mystery. Starts from a checkpoint
  so it doesn't re-solve intake every time. This is the only way to find out
  whether the puzzles are solvable by someone who isn't already the author.
- **Evals that discriminate at the top** `tooling` `M` — the two Claude tiers
  score within a check of each other, so the scenarios establish a floor (where
  a model fails this game) and say nothing about which model plays it _best_.
  Needs harder scenarios, and an argument about what "harder" means beyond "more
  tags".
- **One eval run is one sample** `tooling` `S` — a check that flips between runs
  is indistinguishable from a real regression, which came up immediately when
  tuning the task-list prompt. Repeat runs and a pass rate, rather than a single
  pass/fail, would make small prompt changes measurable instead of arguable.
- **Judge the writing, not just the protocol** `tooling` `M` — nothing scores
  whether a scene was any good. A judge model would make the numbers arguable in
  a way the current ones aren't, which is a real cost; worth it only with a
  rubric that survives disagreement.
- **Save a checkpoint from the browser** `ui` `M` — the running game can now
  _load_ a checkpoint (`?checkpoint=briefed`, or the load menu), but making one
  still means the CLI. Saving the current game as a named checkpoint from the UI
  would close the loop, since noticing you want a fork happens while playing.
- **Split `lib/game/classes.ts`** `engine` `M` — 1722 lines holding Entity,
  Room, Person, Ama, Player and Narrator. The prompt assembly wants to be its
  own module. `worker/access.ts` (322) is the next one after that.
- **Let the player edit their own task list** `ui` `S` — the list is written
  only by characters. A player who decides to do something nobody asked them to
  do has nowhere to put it.

## Backlog

### NPCs

- **Mood and thought consistency** `engine` `M` — an NPC's mood is re-derived
  every turn from history. Track it, so being annoyed persists past the next
  reply.
- **Let NPCs do nothing** `engine` `S` — a prompted NPC almost always speaks.
  Silence and disinterest are characterisation, and the protocol has no way to
  express them.
- **NPC memory** `engine` `L` — NPCs remember only what's in the recent history
  window. Something durable and per-character, so Doug knows you lied to him
  yesterday.
- **NPCs schedule themselves** `engine` `M` — schedules are authored per
  character by hand. An NPC that could add to its own schedule ("I'll check the
  vents after lunch") would make the world feel like it has plans.
- **Structured NPC definitions** `content` `M` — characters are prose blobs. A
  schema (goals, secrets, relationships) would let the prompt include only what
  matters this turn, and let tooling check for contradictions.
- **Action ordering and resolution** `engine` `M` — everyone in a room responds
  in a fixed order, and simultaneous action isn't modelled. Related: fewer NPCs
  present at once, so each one gets room to act.
- **Off-screen simulation** `engine` `L` — the world only moves where the player
  is looking. Cheap summarised simulation elsewhere would make returning to a
  room interesting.

### Play

- **Inventory** `engine` `M` — the HUD has an inventory tab that says "(no
  inventory implemented)". Objects the player carries, that NPCs can see and
  react to, and that can be stolen.
- **Skills, and training them** `engine` `L` — the player has no way to get
  better at anything, so there's no expression of skill and no growth.
- **Dynamic puzzles** `content` `L` — puzzles are hand-authored and pass/fail.
  Puzzles the model can generate and adjudicate would scale past what one author
  can write, if they can be made fair.
- **Plot arcs as entities** `engine` `M` — mysteries are the only structure
  above a room. Arc entities that track their own progress would let a story
  span more than one puzzle.
- **Better randomness** `engine` `S` — the d20 roll is a blunt instrument; a
  failed action mostly means "nothing happened".
- **Changes should show up in descriptions** `engine` `M` — a room's description
  is static text, so what the player did to it is invisible on the next visit.
- **Time, made strange** `content` `M` — the schedule system is a real clock in
  a place that shouldn't have one. Surreal time, interruptible events, and
  events the player can be late for.

### Interface

- **Rich text and better formatting** `ui` `S` — everything is one colour per
  speaker and one shape.
- **Streaming responses** `ui` `M` — the engine parses tags from a stream
  already; the UI still waits for the whole turn. Latency is the loudest
  complaint about the game and this is most of it.
- **Parallel prompts** `engine` `M` — NPC responses in a turn are sequential and
  mostly independent.
- **A real map** `ui` `M` — the map is a Graphviz render fetched from a third
  party, which also means it doesn't work offline or behind Access.
- **Images, and voices** `ui` `L` — generated art per room, speech synthesis per
  character. Both are obvious and both are a lot of work to do without making
  the game slower.

### World and multiplayer

- **Prompt-injection defenses** `engine` `M` — a player can currently talk the
  narrator into most things. Some of that is the fun; some of it isn't.
- **Multiple players** `engine` `L` — including the hard part: two players in
  one room, and what happens when they act at once. Also "at a distance",
  players who never share a room.
- **Player as author** `content` `L` — in-game authoring tools, per-type
  editors, a second player who writes the world while the first plays it. Wants
  the data to stay typed and tested, which is the thread the content split
  started.

### Tooling

- **Evals out of real gameplay** `tooling` `M` — a played session is already an
  event log. Turning an interesting one into a scenario should be a command, not
  a transcription job.
- **Multiple models per game** `tooling` `M` — different models for narration,
  NPCs, and action resolution, chosen by what the evals say each is good at.
  Presets, so a player can pick cost or quality without knowing model names.
- **Prompt engineering tools** `tooling` `M` — editing a prompt means editing
  TypeScript and re-recording a cassette. `pnpm playtest:cache` measures the
  cache prefix; nothing measures whether a prompt change made the game better.
- **Drop the unused `@preact/signals` dependency** `tooling` `S` — the engine
  uses `-core` and the view uses `-react`; the plain package is dead weight.

## Known problems

Things that are wrong rather than missing. No plan attached — listed so nobody
rediscovers them from scratch.

- **The narrative isn't grounded.** The model will happily invent an object,
  a door, or a person's history, and the engine has no way to tell the
  difference between that and something real. Hallucinated objects are the most
  visible form.
- **Puzzles are pass/fail.** There's no partial progress and no second route, so
  a stuck player is stuck.
- **NPC reactions are flat.** Characters respond to the last thing said, at
  roughly the same intensity, whatever happened before.
- **Latency and cost.** Several model calls per turn, none streamed to the
  player.
- **Parsing is ambiguous.** The tag protocol is permissive by design, which
  means some model output is silently interpreted as something other than what
  it meant.
- **Context bloat.** Every prompt carries more history than it needs, and the
  history is the same for every character.
- **Event serialization is load-bearing.** The log is the save format, the
  checkpoint format, and the eval input. Storage now carries a version stamp
  (`lib/storage.ts`), so a shape change can be detected and refused — but
  nothing migrates event _meaning_ except `lib/game/migrate.ts`, written for one
  rename.
