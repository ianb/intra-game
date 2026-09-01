# Slides

A talk about how this game and its apparatus were built, as one self-contained
HTML file.

```bash
pnpm slides          # regenerate slides/index.html
open slides/index.html
```

Presenting: arrow keys or space move, `N` toggles the presenter notes under the
slide, `Home` and `End` jump to the ends, and the URL hash is the slide number,
so a section can be linked or reloaded into. Printing gives one slide per page
with the notes shown.

## Why it is generated

The deck states line counts, commit counts, how many playthroughs were recorded
and how many of them were solved. Those are read from the repo when
`pnpm slides` runs, so a deck presented in three months cannot quietly claim a
number that stopped being true. Regenerate before presenting.

Everything else — the slide text, the quotes, the notes — is written by hand in
[generate.ts](./generate.ts). Quotes are verbatim from the files they cite.

## Voice

The Archivist's footnote lines have their own brief:
[archivist.md](./archivist.md), which carries the character references, the
inspirations, and a per-slide worksheet.

The two voices are the ones defined in [evals/page.ts](../evals/page.ts), and
this deck follows the same split: the Archivist introduces each part and
enthuses, the operators explain the machinery flatly. Section dividers are the
Archivist's; content slides are not. Character names are tinted with the game's
own entity colors, built from the entity list so they cannot drift.

## Not published

`slides/index.html` is committed but not copied into `dist/` by
[build.ts](../build.ts), unlike the eval and playthrough pages. It contains
spoilers and it is a talk rather than a page about the game. Serving it at
`/slides/` is three lines in `build.ts` if that changes.
