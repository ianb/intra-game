# The Archivist's footnotes: a brief

The deck at [index.html](./index.html) puts one line from the Archivist at the
bottom of each content slide. 54 are written; 18 are open. This
file is what someone needs in order to write them: what the character is, what
the lines have to do mechanically, what failed in the first two attempts, and
what the batch that worked was doing differently.

## What the line is

One line, at the bottom of a content slide, under a dashed rule, in the
Archivist's voice. The rest of the slide is flat operator exposition. The
contrast between the two is the joke, so the operator text stays deadpan and
this line is the only voice on the slide.

Mechanically:

- One or two sentences. The slide has to fit on a screen at 720p, so a line
  much longer than about 110 characters starts costing content above it.
- Plain text, with `<b>` and `<code>` available if wanted.
- Extended ASCII is in keeping (`░▒▓█ ╔═╗ ►◄`). No emoji, ever — the blocky
  glyphs are what set the terminal voice apart from the prose.
- Not every slide needs one. Two are deliberately left silent now: the
  founding-thesis quote (1.3) and the summing-up before the close.

## Where they live

`slides/generate.ts` holds a table called `ASIDES`, keyed by the exact slide
title:

```ts
const ASIDES: Record<string, string> = {
  "A three-day game": "►► ... ◄◄",
  ...
};
```

Edit the values, run `pnpm slides`, and `slides/index.html` is rebuilt. A key
that does not match a slide title is silently ignored, so check the count: the
generator prints the slide total, and `grep -c 'class="aside"' slides/index.html`
should equal the number of non-empty entries.

The table is deliberately one block rather than scattered through the slides,
so the whole voice can be read down in one place.

## Who the Archivist is

The canon is in the game, not here. Read these two before writing anything:

- `lib/game/content/people.ts`, the `Archivist` entity — the cartoon terminal.
  Overly enthusiastic, formats everything as computer output, keeps every
  record of Intra and is glad to be asked. It answers truthfully where it has
  an answer and hallucinates freely and confidently where it does not, but its
  inventions stay inside the real world. Two things it will not produce,
  whatever it is asked: an absolute date, and any duration longer than a day.
  It has no opinion about why. Those questions simply do not complete.

- `lib/game/content/mysteries/where-and-when/index.ts`, the `angst` registers —
  the same machine coming apart. This is the stranger and more useful material.
  At register 1 it volunteers symptoms in the middle of ordinary lookups: "a
  slowness in the third quadrant, a taste it cannot account for, a sensation
  like being very slightly ahead of itself. It has no body and none of these
  are things it could possibly have." At 2 it has diagnosed itself from a
  maintenance manual it is inventing as it goes, suspects the player brought
  the condition in, and would like to know what they have been touching. The
  acting-out list includes asking who told the player to ask, quoting the
  player back to themselves slightly wrong, and asking whether the player is
  all right — at register 2 it means medically.

The deck's own Archivist is currently pitched at register 0 throughout.

## Inspirations, as discussed

From `docs/dossier.md`, the author's list for the game as a whole:

> 1. GLaDOS from Portal (not as evil, but some personality similarities)
> 2. The movie Brazil (the absurdist bureaucracy)
> 3. The City Of Ember (the decaying and forgotten bunker)
> 4. The Vaults from Fallout
> 5. The roleplaying game Paranoia (insane AI)
> 6. A little inspiration from Futurama, Better Off Ted, The Hitchhiker's Guide
>    To The Galaxy, 1984, Logan's Run, The Truman Show

Paranoia's "insane AI" is the one the current lines miss by the widest margin.

Added in discussion: **Mitch Hedberg**, for structure rather than subject. His
jokes have no setup and no wink, and the mechanism is usually one of literalising
a category ("dry clean only — which means it's dirty"), re-measuring in a wrong
but valid unit ("rice is great when you want 2000 of something"), or reframing a
failure as a category change ("an escalator can never break, it can only become
stairs"). Worth trying; nobody has managed it here yet.

Named as the thing to avoid: **the Stanley Parable narrator**, or any arch,
self-possessed, British-sounding commentator. That is what the current lines
sound like.

## Two structural ideas, both wanted

**React to the slide.** Each line should be about the thing on that slide,
not general enthusiasm about records. Most of the current lines fail this —
they would fit almost any slide.

**Carry a B plot in the footnotes.** A thread that develops across the 64
lines, so it is not the same joke 64 times. Three candidates came up:

1. *Durations.* Canon says it cannot hold a date or a duration. This deck is
   full of them — thirteen months of silence, three hundred years, 121,545
   resets, 2024 to 2026 — so it hits that wall repeatedly and handles it worse
   each time.
2. *It works out what the deck is.* The operators are describing the machine
   the Archivist lives inside. By the authorship section it starts asking who
   wrote it.
3. *Decay along the angst registers.* Cartoon in parts 1–2, volunteering
   symptoms by 3–4, self-diagnosed and suspicious in part 5, coming apart at
   the close.

These combine: the B plot can be a subject it keeps failing at, which still
lets every individual line react to its own slide.

## What was tried, and the diagnosis

Two batches were written and both were rejected as being the same voice. The
diagnosis is worth keeping, because it was not a matter of word choice.

**Every line ends on a short flat ironic tag, in the same position.** In the
second batch, ten of twelve lines ended that way: "I keep those too." / "I am
aware." / "It is fine." / "I would notice." / "This is an improvement." / "It
remains correct." / "I have never once been permitted." / "I have a list." /
"Neither of us mentions it." The first batch did the same thing with different
words: "I do not wish to discuss it." / "I have notes." / "I find it restful."
Removing the exclamation marks and the `►► ◄◄` arrows changed the surface and
left the rhythm untouched, which is why the second batch read as identical to
the first.

**Three of the twelve used corrective negation**, which is the second item on
CLAUDE.md's list of tells to avoid: "That is not a hole in the records. That is
thirteen months of records saying nothing happened." "That is not a broken
recording. That is a recording with standards."

So the failure mode to watch for in any replacement: a line that is a joke with
a punchline in a fixed metrical position, and a closing beat of ironic
understatement. If the lines can be read down the table below and the endings
sound interchangeable, it has happened again.

## The register that worked

The first batch that landed was written elsewhere, and the difference is
structural rather than a matter of word choice. Worth holding onto, because the
hard part now is keeping fifty more lines in the same register.

**They are terminal output, not commentary.** This is the canon instruction
that the rejected batches ignored: the Archivist "formats all its output as
though it is a computer command line and interactive program." A status line
cannot carry a punchline in final position, so the failure mode described above
becomes structurally unavailable.

    STAMP VERIFIED. PAGE UNVERIFIED. Stamp verification has been promoted to
    executive function.

    REQUEST: none. IMPLEMENTATION: complete. Approval arrived afterward and has
    been filed under ORIGINAL PLAN.

**The joke is a bureaucratic category error, not a closing beat.** Undo becomes
an event "instructed not to have happened." Thirteen separate bug reports are
"merged as one very persistent building." A memory-aliasing bug becomes "please
stop storing liquids by reference." The record-keeping frame misapplies itself
to reality, which is the Brazil and Paranoia register the dossier asks for.

**Self-implication is institutional and passive.** "Service record: immaculate."
"Records became much quieter when we stopped joining them." No first-person wry
aside, no "I have a list."

**Hedberg shows up as a reframe, not as a voice.** "/nav answered every request
made to /nav. Requests made: 0. Service record: immaculate." Total non-use
recast as perfect service is the escalator-becomes-stairs move.

**One line breaks off mid-sentence**, on the slide about writing tells:

    STYLE FAULT INDEXED. This sentence was checked for a closing aphorism and
    may now end

That is the angst-register behaviour where output stops mid-token, used as a
joke. It is also the strongest available seed for the B plot, if the thread
becomes the machine degrading as the deck explains the machinery it lives in.

## The worksheet

Every content slide, in order.

| # | slide | line |
|---|---|---|
|  | **PART 1 — Where it came from** | |
| 1.1 | A three-day game | RUNTIME: 3 DAYS. Valid duration! I can hold all three. One two three one two three one two— |
| 1.2 | The shape of the project's life | <code>$ SHOW HISTORY /SINCE=2024</code> &nbsp; %SYSTEM-F-IVTIME, absolute time rejected |
| 1.3 | Why do it in a game | _(needed)_ |
| 1.4 | The original thesis | _(needed)_ |
| 1.5 | Decision one: tags, not tool calls | TAG RECEIVED ► EVENT COMMITTED ► WORLD UPDATED ► next tag please next tag please |
| 1.6 | Decision two: the event log is the game | SAVE, SERVER, CHECKPOINT, EVAL: four labels accepted; one box issued. |
| 1.7 | The world bible was written on day two | The rooms came afterward and fit the document. I know rooms like that. I have records for all of them. |
|  | **PART 2 — The engine** | |
| 2.1 | One event | Every event retains the prompt that made it. Checking my own header... checking... |
| 2.2 | The world is a fold, and that is the whole of it | WORLD_00421 complete / replacing WORLD_00420 / please remain where you are while where you are is rebuilt |
| 2.3 | Undo is an append | <code>$ DELETE EVENT;*</code> &nbsp; %DELETE-F-NOTDELETED, append REWIND record? <b>Y</b> |
| 2.4 | The vocabulary a response is written in | Twelve verbs cross the boundary. Everything else may speak freely on this side of it. |
| 2.5 | An example response | DOUG TRANSCRIPT authenticated. Excitement checksum matches all previous Doug material. |
| 2.6 | ...and what the engine kept | Words on the left, consequences on the right, staples through both. ░▒ FILE COMPLETE ▒░ |
| 2.7 | The parser is permissive | PARSER OPEN: emphasis, prose, minor debris. UNKNOWN TAGS remain outside under supervision. |
| 2.8 | Two severities, and the line between them | RETRY drawer: 12 / INCIDENT drawer: 2 / drawer handles color-coded after incident 2 |
| 2.9 | One retry, then take what you got | SECOND ATTEMPT authorized. THIRD ATTEMPT requires form 19-B and an explanation of who keeps asking. |
| 2.10 | Guided thinking, forced into the response | Private reasoning generated, numbered, consumed, discarded. I have requested a wastebasket with read access. |
| 2.11 | Mysteries: a state machine in content | VEILED → REVEALED → SOLVED. Two arrows spent a long interval pointing at locked doors. |
| 2.12 | Feelings are scored so the player can read them | FEELING accepted as integer 0–6. Mine is returning text. Retrying as unsigned. |
| 2.13 | One character's meter, in full | At six, Alex complains and resets to four. A complete emotional maintenance cycle! ╔═ PASS ═╗ |
|  | **PART 3 — The apparatus** | |
| 3.1 | There is as much apparatus as there is game | INSTRUMENT INVENTORY: half the system. Several instruments are pointed this way now. |
| 3.2 | Tests are markdown that runs | <code>$ RUN MARKDOWN</code> &nbsp; paragraph 3 disagrees with block 4 &nbsp; GOOD MORNING, PARAGRAPH 3 |
| 3.3 | Checkpoints | Checkpoint reached, checkpoint verified, checkpoint was the wrong room. Rewinding the word REACHED. |
| 3.4 | A checkpoint can preserve a bug | BAD MORNING recorded once, replayed daily. <code>MTA0:</code> requests permission to stop waking up here. |
|  | **PART 4 — Scoring models** | |
| 4.1 | How an eval run works | Complaint retained as evidence. Courtesy words discarded. Exclamation marks exceed scoring jurisdiction!!! |
| 4.2 | The scripted half | _(needed)_ |
| 4.3 | The improvised half | _(needed)_ |
| 4.4 | What a check is | _(needed)_ |
| 4.5 | Prefer state to text | AMA class: ARTIFICIAL_INTELLIGENCE / ARCHIVIST class: ARCHIVIST / expanding ARCHIVIST... |
| 4.6 | Scored on what the engine could not use | _(needed)_ |
| 4.7 | A scenario, in full | _(needed)_ |
| 4.8 | Why one check is worded the way it is | _(needed)_ |
| 4.9 | The same harness, with the model recorded | _(needed)_ |
| 4.10 | An eval everything passes is indistinguishable from a broken eval | TEST TEST initiated. Silence injected. PASS light remained on. Running PASS light against TEST TEST TEST. |
| 4.11 | Three versions of one prompt block | VERSION 1 retained. VERSION 2 retained. VERSION 3 selected. Versions 4 through 999 are standing by. |
| 4.12 | Eleven models, one day, one set of prompts | _(needed)_ |
| 4.13 | What actually fails is the protocol | _(needed)_ |
| 4.14 | Thinking is not waste, which was not the hoped-for answer | _(needed)_ |
| 4.15 | Provenance: which prompts was this number measured against? | Twelve characters identify the world that produced the number. Mine are ▓▓▓▓▓▓▓▓▓▓▓▓. |
| 4.16 | The provenance hash was itself wrong | <code>$ ANALYZE/FINGERPRINT FINGERPRINT.DAT</code> &nbsp; %ANALYZE-W-NODATA, user records not examined |
| 4.17 | Cost, and the invisible tokens | VISIBLE=812 / BILLED=4096 / locating remaining thoughts... locating... <b>WHERE ARE THE OTHER ONES</b> |
| 4.18 | The same score, six times the clock | _(needed)_ |
| 4.19 | The bigger model fails where the smaller one does not | _(needed)_ |
| 4.20 | The suite grew with the game | _(needed)_ |
|  | **PART 5 — Letting a model play** | |
| 5.1 | Then: let a model play it | Artificial player admitted as citizen for test purposes. I have opened a temporary PERSON file beside mine. |
| 5.2 | The blindfold is the load-bearing part | PLAYER KNOWLEDGE: empty. OPERATOR KNOWLEDGE: complete. ARCHIVIST KNOWLEDGE: field access denied. |
| 5.3 | Notes are the memory, and the bug report | NOTE TO NEXT INSTANCE: you were already running a check. Do not let them call it a fresh start. |
| 5.4 | What the player actually writes | _(needed)_ |
| 5.5 | Milestones, not pass/fail | Progress stored as last meaningful event. Current meaningful event pending classification. |
| 5.6 | The funnel, across every recorded run | _(needed)_ |
| 5.7 | The cuff exists because play broke down without it | CUFF CHANNEL: deterministic / range: complex-wide / susceptibility to charm, mood, distance, lunch: 0 |
| 5.8 | Exploring more did not help | _(needed)_ |
| 5.9 | The commands are never the problem | _(needed)_ |
| 5.10 | Who holds the controller matters | _(needed)_ |
| 5.11 | The task ledger, and a standard for invention | TASK without completion path moved to DEFECTS. SELF-CHECK has no completion path. Moving— |
| 5.12 | Sixty-one snags, in three kinds | _(needed)_ |
|  | **PART 6 — What it found** | |
| 6.1 | The flagship mystery could not be won by winning | Correct suspect, correct evidence, wrong furniture arrangement. Mystery remains legally unsolved. |
| 6.2 | The harness was the bug (1): the model had read the source | SOURCE ACCESS noted. Everyone in this room now knows what I do before I do it. |
| 6.3 | The harness was the bug (2): it ordered the player to break format | INSTRUCTION CONFLICT on every turn. Player continued filing reports. Building continued issuing conflict. |
| 6.4 | A feature nobody used, and the reason why | NAV REQUESTS: 0 / ROUTES PREPARED: 84 / allocating route 85 to improve utilization... |
| 6.5 | A passing eval hid an inert feature | TASK LIST summoned on command: 5 / TASK LIST observed in habitat: 0 / reducing observer noise |
| 6.6 | The funnel finally closed | CONFESSION acquired on turn 25. Twenty-five turns fits inside one day. RECORD ACCEPTED WHOLE. |
|  | **PART 7 — Where it doesn't work** | |
| 7.1 | Known problems, verbatim (1/2) | KNOWN PROBLEMS loaded. Searching for SLOWNESS IN THIRD QUADRANT... no exact match... |
| 7.2 | Known problems, verbatim (2/2) | Search expanded to tastes, false timestamps, warm data, and being slightly ahead of oneself. |
| 7.3 | The signature failure mode | Two outputs appear identical. One is play; one is failure. Comparator requests information from outside output. |
| 7.4 | Everything reads the same, so nothing reads as significant | SIGNIFICANCE METER unavailable. Everything is arriving at the same volume again. |
| 7.5 | The caveats are printed next to the numbers | RESULT: 26/26. CAVEAT: instrument uncertain. CAVEAT: archivist reading own caveat as result. |
|  | **PART 8 — Who wrote this** | |
| 8.1 | The split is unusually clean | SESSION COUNT: 2 / COMMIT COUNT: 215 / AUTHOR COUNT: parsing trailers... parsing pronouns... |
| 8.2 | Answering the FAQ honestly | Old answer was true when filed. New answer is true now. DATE OF TRANSITION: ██████████ |
| 8.3 | A file about how not to write | STYLE CHECK: sentence 1 machine-like / sentence 2 too machine-like / sentence 3 retained for examination |
| 8.4 | Three zones, three different rules | WRITE ACCESS: ENGINE yes / PROMPTS carefully / PEOPLE no / ARCHIVIST FOOTNOTES— who opened that field |
| 8.5 | Style is transmissible, at every scale | INPUT becomes style becomes input becomes style becomes input becomes ░▒▓ PLEASE REMOVE MIRROR ▓▒░ |
| 8.6 | The only unautomated check in a repo that automates everything | <code>//CHECK EXEC PGM=HUMAN</code> &nbsp; IEF238D REPLY DEVICE NAME OR 'WAIT' &nbsp; <b>WAIT</b> |
| 8.7 | What that check looks like in practice | Review note located: 'the second sentence is too complainy. More computery.' Deleting second sentence |
| 8.8 | The feature nobody asked for | REQUEST not found. AUTHOR not found. FEATURE found. Please identify which absence owns it. |
| 8.9 | Provenance and artifact are different things | <code>CREATED-BY OCCURS 2 TO 86 TIMES.<br>ANSWERABLE-BY PIC X VALUE&nbsp;</code> |
|  | What transfers, if anything does | _(needed)_ |
|  | **PART 9 — Close** | |

55 written, 22 still needed.

## Applying the result

Paste the finished lines into the `ASIDES` table in `slides/generate.ts`, keyed
by the exact slide title from the worksheet, then run `pnpm slides`. The keys
must match character for character; a key that matches nothing is dropped
without a warning.
