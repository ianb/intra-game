# The Archivist's footnotes: a brief

The deck at [index.html](./index.html) puts one line from the Archivist at the
bottom of each content slide. Thirteen are written; the rest are open. This
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

Every content slide, in order. Thirteen have lines. The rest are open.

| # | slide | line |
|---|---|---|
|  | **PART 1 — Where it came from** | _(needed)_ |
| 1.1 | A three-day game | _(needed)_ |
| 1.2 | The shape of the project's life | _(needed)_ |
| 1.3 | The thesis, from the 2024 README | _(needed)_ |
| 1.4 | Decision one: tags, not tool calls | _(needed)_ |
| 1.5 | Decision two: the event log is the game | _(needed)_ |
| 1.6 | The world bible was written on day two | _(needed)_ |
|  | **PART 2 — The engine** | _(needed)_ |
| 2.1 | One event | _(needed)_ |
| 2.2 | The world is a fold, and that is the whole of it | WORLD BUILD complete. WORLD BUILD complete. WORLD BUILD complete. Uptime: one event. |
| 2.3 | Undo is an append | UNDO accepted. The event remains on file, but has been instructed not to have happened. |
| 2.4 | The bug that shallow copying was always going to cause | FEELING "suspicious" found in two citizens and one backup. Please stop storing liquids by reference. |
| 2.5 | What the model is allowed to say | _(needed)_ |
| 2.6 | One real turn, as the model produced it | _(needed)_ |
| 2.7 | ...and what the engine kept | _(needed)_ |
| 2.8 | The parser is permissive on purpose | _(needed)_ |
| 2.9 | Two severities, and the line between them | _(needed)_ |
| 2.10 | Exactly one retry, and the reason is money | _(needed)_ |
| 2.11 | The judgment scaffold | _(needed)_ |
| 2.12 | Prompts are ordered for a cache that does not exist yet | _(needed)_ |
| 2.13 | A prompt block tuned by measurement, not taste | _(needed)_ |
| 2.14 | Mysteries: a state machine in content | _(needed)_ |
| 2.15 | The trigger vocabulary is closed on purpose | _(needed)_ |
| 2.16 | Replaying a log does not re-run its triggers | _(needed)_ |
| 2.17 | Feelings, counted rather than judged | _(needed)_ |
| 2.18 | A meter, as authored | _(needed)_ |
| 2.19 | Attitudes: sparse, and never neutral | _(needed)_ |
| 2.20 | The lunch problem | _(needed)_ |
| 2.21 | Two kinds of locked door | _(needed)_ |
| 2.22 | The cuff exists because play broke down without it | _(needed)_ |
|  | **PART 3 — The apparatus** | _(needed)_ |
| 3.1 | There is as much apparatus as there is game | _(needed)_ |
| 3.2 | Tests are markdown that runs | This document can prove itself wrong. Most documents require a committee. |
| 3.3 | Cassettes: recorded model calls, replayed offline | Recording expired because the words around it moved. The voice remains fresh and is now incorrect. |
| 3.4 | The one idea most worth stealing | _(needed)_ |
| 3.5 | Checkpoints, and a fixture that lied | _(needed)_ |
| 3.6 | A fixture can also preserve a bug | _(needed)_ |
| 3.7 | What an eval scores | _(needed)_ |
| 3.8 | Prefer state to text | _(needed)_ |
| 3.9 | An eval everything passes is indistinguishable from a broken eval | _(needed)_ |
| 3.10 | Provenance: which prompts was this number measured against? | _(needed)_ |
| 3.11 | The provenance hash was itself wrong | STAMP VERIFIED. PAGE UNVERIFIED. Stamp verification has been promoted to executive function. |
| 3.12 | Cost, and the invisible tokens | _(needed)_ |
| 3.13 | Then: let a model play it | _(needed)_ |
| 3.14 | The blindfold is the load-bearing part | _(needed)_ |
| 3.15 | Notes are the memory, and the bug report | _(needed)_ |
| 3.16 | Milestones, not pass/fail | _(needed)_ |
| 3.17 | The task ledger, and a standard for invention | _(needed)_ |
|  | **PART 4 — What it found** | _(needed)_ |
| 4.1 | The flagship mystery could not be won by winning | _(needed)_ |
| 4.2 | The harness was the bug (1): the model had read the source | PLAYER issued building plans before entering building. Exploration proceeded at administrative speed. |
| 4.3 | The harness was the bug (2): it ordered the player to break format | Thirteen reports received: BUILDING IS REQUESTING TAGS. Incident merged as one very persistent building. |
| 4.4 | A feature nobody used, and the reason why | /nav answered every request made to /nav. Requests made: 0. Service record: immaculate. |
| 4.5 | A passing eval hid an inert feature | TASK LIST appeared whenever inspectors requested it. Citizens have not learned this technique. |
| 4.6 | The funnel finally closed | _(needed)_ |
|  | **PART 5 — Where it doesn't work** | _(needed)_ |
| 5.1 | Known problems, verbatim (1/2) | _(needed)_ |
| 5.2 | Known problems, verbatim (2/2) | _(needed)_ |
| 5.3 | The signature failure mode | _(needed)_ |
| 5.4 | Everything reads the same, so nothing reads as significant | _(needed)_ |
| 5.5 | The caveats are printed next to the numbers | _(needed)_ |
|  | **PART 6 — Who wrote this** | _(needed)_ |
| 6.1 | The split is unusually clean | _(needed)_ |
| 6.2 | Answering the FAQ honestly | _(needed)_ |
| 6.3 | A file about how not to write | STYLE FAULT INDEXED. This sentence was checked for a closing aphorism and may now end |
| 6.4 | Three zones, three different rules | _(needed)_ |
| 6.5 | Style is transmissible, at every scale | _(needed)_ |
| 6.6 | The only unautomated check in a repo that automates everything | _(needed)_ |
| 6.7 | What that check looks like in practice | _(needed)_ |
| 6.8 | The feature nobody asked for | REQUEST: none. IMPLEMENTATION: complete. Approval arrived afterward and has been filed under ORIGINAL PLAN. |
| 6.9 | Provenance and artifact are different things | CREATED BY and ANSWERED FOR are separate fields. Records became much quieter when we stopped joining them. |
|  | What transfers, if anything does | _(needed)_ |

13 written, 52 still needed.

## Applying the result

Paste the finished lines into the `ASIDES` table in `slides/generate.ts`, keyed
by the exact slide title from the worksheet, then run `pnpm slides`. The keys
must match character for character; a key that matches nothing is dropped
without a warning.
