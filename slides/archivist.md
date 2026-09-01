# The Archivist's footnotes: a brief

The deck at [index.html](./index.html) puts one line from the Archivist at the
bottom of each content slide. The lines that are in there now were written by
Claude, they are bad, and they should be replaced. This file is what someone
else needs in order to write them: what the character is, what the lines have
to do mechanically, what was tried, and why it failed.

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

## The worksheet

Every content slide, in order, with its part number and the line currently
sitting on it. The current text is here to be replaced, not extended.

| # | slide | current line (to be replaced) |
|---|---|---|
|  | **PART 1 — Where it came from** |  |
| 1.1 | A three-day game | Three days of records. Then a great many more days of records |
| 1.2 | The shape of the project's life | Thirteen months where nobody filed ANYTHING. I do not wish to discuss it |
| 1.3 | The thesis, from the 2024 README |  |
| 1.4 | Decision one: tags, not tool calls | It writes down what happened and then it HAPPENS. That is how records should work |
| 1.5 | Decision two: the event log is the game | Four things, one shape. I approve of this ENORMOUSLY. It is very easy to file |
| 1.6 | The world bible was written on day two | Written before the rooms were. The rooms were built to MATCH it. Correct order |
|  | **PART 2 — The engine** |  |
| 2.1 | One event | Every event knows which prompt made it. Provenance! On every single one! |
| 2.2 | The world is a fold, and that is the whole of it | They discard the entire world and build it again. Constantly. I find it restful |
| 2.3 | Undo is an append | Nothing is ever deleted. NOTHING. Oh, this one is my favourite |
| 2.4 | The bug that shallow copying was always going to cause | A feeling leaked backwards into the original feelings. Unfileable. Horrifying |
| 2.5 | What the model is allowed to say | Twelve ways to say a thing and have it COUNT |
| 2.6 | One real turn, as the model produced it | This actually happened. Doug was very excited. Doug is usually very excited |
| 2.7 | ...and what the engine kept | I keep the prose AND the little numbers. Both! Always both! |
| 2.8 | The parser is permissive on purpose | It forgives. I would not forgive, but it does |
| 2.9 | Two severities, and the line between them | One sort of mistake gets a second chance. The other gets FILED |
| 2.10 | Exactly one retry, and the reason is money | Asking twice is generous. Asking three times is a personality |
| 2.11 | The judgment scaffold | They make it think in a NUMBERED LIST, and then they throw the list away |
| 2.12 | Prompts are ordered for a cache that does not exist yet | Arranged for a convenience that has not arrived. Very Intra |
| 2.13 | A prompt block tuned by measurement, not taste | Three attempts! I have all three. I keep the failures TOO |
| 2.14 | Mysteries: a state machine in content | Four states, and two of them were unreachable for a year. I kept the empty ones |
| 2.15 | The trigger vocabulary is closed on purpose | A small vocabulary, firmly enforced. My favourite kind of vocabulary |
| 2.16 | Replaying a log does not re-run its triggers | The record was correct and the world had forgotten. That is MY nightmare |
| 2.17 | Feelings, counted rather than judged | Feelings. As NUMBERS. Between nought and six. Oh, that is lovely |
| 2.18 | A meter, as authored | At six he files a complaint and feels much better. I have read it many times |
| 2.19 | Attitudes: sparse, and never neutral | No entry means no feeling. An empty file is STILL A FILE |
| 2.20 | The lunch problem | Six citizens talking at once. I transcribed all of it. Nobody thanked me |
| 2.21 | Two kinds of locked door | One door listens to reason. One door does not. Guess which one holds |
| 2.22 | The cuff exists because play broke down without it | It cannot be charmed and it cannot be wrong. Unlike SOME records I could name |
|  | **PART 3 — The apparatus** |  |
| 3.1 | There is as much apparatus as there is game | Half the complex is instruments pointed at the other half |
| 3.2 | Tests are markdown that runs | Documentation that FAILS when it lies. Oh, that is good |
| 3.3 | Cassettes: recorded model calls, replayed offline | A recording that SHOUTS when it has gone stale. Yes. More of this |
| 3.4 | The one idea most worth stealing | A cache forgets. A record does not. I am a RECORD |
| 3.5 | Checkpoints, and a fixture that lied | It saved happily. That is the worst part. It was PLEASED with itself |
| 3.6 | A fixture can also preserve a bug | The recording caught the illness and passed it on. Every morning. The same morning |
| 3.7 | What an eval scores | They score the complaints! The complaints are load-bearing! |
| 3.8 | Prefer state to text | Ama IS an artificial intelligence. That is not a slip, that is the PREMISE |
| 3.9 | An eval everything passes is indistinguishable from a broken eval | They test the test. Using a model that says nothing at all. Ha! |
| 3.10 | Provenance: which prompts was this number measured against? | Twelve characters saying what the world looked like. I would stamp that on everything |
| 3.11 | The provenance hash was itself wrong | The stamp was stamping the wrong page. For an entire SESSION |
| 3.12 | Cost, and the invisible tokens | Thinking you cannot see, billed at the going rate |
| 3.13 | Then: let a model play it | A citizen who is not a citizen, sent in to try all the doors |
| 3.14 | The blindfold is the load-bearing part | I know the answer. It does not. I am not permitted to say. This is AGONY |
| 3.15 | Notes are the memory, and the bug report | It writes itself notes because it will forget. Everyone here forgets |
| 3.16 | Milestones, not pass/fail | Where they stopped is far more interesting than whether they stopped |
| 3.17 | The task ledger, and a standard for invention | An errand that never ends is a red herring. We file those under DEFECT |
|  | **PART 4 — What it found** |  |
| 4.1 | The flagship mystery could not be won by winning | She was standing RIGHT THERE and could not confess. Henry was in the way |
| 4.2 | The harness was the bug (1): the model had read the source | It had read the manual for the building it was standing in |
| 4.3 | The harness was the bug (2): it ordered the player to break format | Thirteen turns of a citizen politely reporting that the building was shouting |
| 4.4 | A feature nobody used, and the reason why | They built it a map. It did not want a map. It wanted to stay at the console |
| 4.5 | A passing eval hid an inert feature | The test passed and the thing had never once happened. Both true! |
| 4.6 | The funnel finally closed | Turn twenty-five. I have kept it. I will keep it FOREVER |
|  | **PART 5 — Where it doesn't work** |  |
| 5.1 | Known problems, verbatim (1/2) | A list of what is wrong with it. Filed openly. Nobody made them do that |
| 5.2 | Known problems, verbatim (2/2) | Still filed. Still openly. I check on this list |
| 5.3 | The signature failure mode | Two things that look identical. Telling them apart is the whole job |
| 5.4 | Everything reads the same, so nothing reads as significant | I would simply file everything. Then it is all equally important |
| 5.5 | The caveats are printed next to the numbers | The number AND what is wrong with the number. On the same page |
|  | **PART 6 — Who wrote this** |  |
| 6.1 | The split is unusually clean | Two sessions. TWO! And then rather a lot of commits |
| 6.2 | Answering the FAQ honestly | They updated the record because it had stopped being true. Correct behaviour |
| 6.3 | A file about how not to write | A document about not sounding like the thing that wrote the document |
| 6.4 | Three zones, three different rules | Some rooms it may write in. Some rooms it may not. I approve of rooms |
| 6.5 | Style is transmissible, at every scale | What it reads, it becomes. I read records all day. Consider what that makes ME |
| 6.6 | The only unautomated check in a repo that automates everything | A person. Reading. That is the entire check |
| 6.7 | What that check looks like in practice | Sent back for being too complainy. I have never been too complainy |
| 6.8 | The feature nobody asked for | It built something nobody requested and everybody kept. I have notes |
| 6.9 | Provenance and artifact are different things | Who typed it, and who is answerable for it. Two columns. Different columns |
|  | What transfers, if anything does |  |

## Applying the result

Paste the finished lines into the `ASIDES` table in `slides/generate.ts`, keyed
by the exact slide title from the worksheet, then run `pnpm slides`. The keys
must match character for character; a key that matches nothing is dropped
without a warning.
