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
- **Exercise a real provider from the server** `infra` `S` — the streaming path
  is now verified against `pnpm fakeprovider` (framing, deltas, the usage chunk,
  cost, cached tokens, per-tier model choice), so what's left is whether a real
  provider agrees. OpenRouter is one key away: `OPENROUTER_API_KEY` in
  `.dev.vars`, `DEV_FAKE_LLM` commented out, `pnpm preview`, one turn. The
  gateway is the same exercise with `CF_ACCOUNT_ID`/`CF_AIG_TOKEN`, and would
  additionally confirm the `cf-aig-authorization` header, which nothing has ever
  sent for real.
- **Publish the callback-box dev deps** `tooling` `S` — `agent-doctest` and
  `personal-vibe-check` are `file:` dependencies pointing outside the repo, so
  nobody without that checkout can run the test suite or the linter. They are
  `optionalDependencies` so at least `pnpm install` succeeds without them: as
  devDependencies pnpm tried to link them even under `--prod`, which failed the
  install outright and would have failed the first Cloudflare build.

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
  players who never share a room. The identity half is done — Access verifies an
  email and every server-side name derives from it, so opening the Access policy
  would already give strangers their own games — but nothing lets two people
  into the _same_ one.
- **Player as author** `content` `L` — in-game authoring tools, per-type
  editors, a second player who writes the world while the first plays it. Wants
  the data to stay typed and tested, which is the thread the content split
  started.

### Tooling

- **The sliding history makes caching stop at the system message** `engine` `L`
  — `historyForEntity` returns the last N events, so once the window fills,
  every turn drops the oldest message and this turn's history isn't a prefix of
  the last one. Combined with the volatile system content sitting _before_ the
  history, the cacheable prefix is ~1484 tokens of a ~2671-token request and
  cannot grow (`pnpm playtest:cache`). Fixing it needs both halves: move the
  volatile system text after the history, and re-anchor the window in chunks
  (hold it for K turns, then jump) instead of sliding by one, which buys K-1
  hits out of K. Trades directly against context bloat, so it wants numbers
  before it wants code.
- **Nothing actually asks for prompt caching** `engine` `M` — there is no
  `cache_control` anywhere in `lib/llm.ts`, `worker/aigateway.ts` or
  `evals/openrouter.ts`. Anthropic caching is opt-in per content block, and the
  default models are Anthropic, so the stable-first prompt ordering currently
  buys nothing at runtime: it is a precondition that has never been cashed in.
  The work is to split the system message at the barrier line in
  `Person.assemblePrompt` ("[Everything above is fixed…]"), send it as content
  blocks, and mark the stable one. Do it for the character prompts only —
  `pnpm playtest:cache` says they are ~2530 tokens with 86% stable, while every
  player-side prompt is 480–870 tokens and under Anthropic's 1024-token
  minimum, so no ordering could make them cacheable. Note the cacheable region
  is ~1484 tokens (see the item above), which clears the Sonnet-class minimum
  but not the ~2048 for Haiku-class — the tier this game targets — so on Haiku
  this buys nothing until the sliding-window problem is fixed too. Needs testing
  against a real provider before it ships: a malformed content block fails the
  request, which breaks the game rather than merely costing money.

- **Keep Claude's voice out of the game** `content` `M` — see
  [CLAUDE.md](CLAUDE.md). The rule for now is "don't write content prose, and
  write prompts flat", which relies on a person noticing. Worth thinking about
  whether anything better is possible: a check that flags Claude-typical
  constructions in `lib/game/content/**` and in prompt literals would catch the
  obvious cases, and a judge-model eval on prose style would catch drift in what
  characters actually say — but both are the "scoring taste" problem the evals
  have avoided so far, and a bad detector that everyone learns to ignore is
  worse than none.

- **Evals out of real gameplay** `tooling` `M` — a played session is already an
  event log. Turning an interesting one into a scenario should be a command, not
  a transcription job.
- **Decide which prompts can run small** `tooling` `M` — the mechanism is in
  place: prompts declare a tier, the deployment picks the models, and `pnpm
evals --flash <model>` scores a pair. What's missing is the measurement. Only
  `player input` and `describe people` declare `flash` today; `player examine`,
  `player move` and `player action` are on the pro tier because that is what
  they have always been, not because anyone checked. Caching is not the
  obstacle — `pnpm playtest:cache` says character prompts and player-side
  prompts share 19 characters of prefix, so they were never in the same cache
  entry — so this is purely "does a small model get these right".
- **Model presets** `ui` `S` — a player picks cost or quality, not model names.
  Wants the answer to the item above first, since a preset is a claim about what
  works.
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
