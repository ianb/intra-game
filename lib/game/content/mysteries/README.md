# Mysteries

One directory per mystery. Everything about it is in that directory, so reading
it tells you what the mystery is, when it arrives, who knows what, how it ends,
and whether it still works.

```
ink-and-echo/
  index.ts   the mystery: triggers, hints per character, how it resolves
  eval.ts    the scenario that scores whether a model can still play it
```

This replaced a proposal for a `pnpm mysteries` command that would have read the
same facts and reported on them. A tool that summarises scattered data is a
worse answer than data that isn't scattered — it has to be run, kept in step,
and believed.

## What a built mystery has

- **Triggers.** How it moves between states, declared here rather than in
  whoever happens to announce it. `{ enteredRoom, solved, talkedTo, turnsPlayed }`
  are the conditions; `becomes` is the state; `announcedBy` names who reads the
  `introduction` out, if anyone.
- **Hints, per state.** `availableHints` while it can be stumbled into,
  `revealedHints` while it is being investigated, `solvedHints` afterwards. Each
  is keyed by character, and that character's key is the only thing that
  reaches their prompt. A hint on the `"*"` key goes to everyone.
- **A way to end.** Some character, in some condition, responds with
  `<resolveMystery id="...">`. Without one the mystery is scenery.
- **An eval.** `eval.ts`, registered in `evals/scenarios.ts`.

`your-age/` and `intra-location/` have none of this. They are names, and the
directories are empty enough to show it.

## The four states

`veiled → available → revealed → solved`, and never backwards. Only forward
transitions fire, so a trigger written for a mystery the player has already got
further into is ignored rather than being a bug.

`available` is the interesting one and was unreachable until triggers existed:
it means the game will answer if asked, but has not raised the subject. That is
how a mystery the player brings with them should work, as against an errand Ama
hands over.

## The one rule

**Nothing under `lib/` imports an `eval.ts`.** They sit here for the author's
benefit, but they import the eval harness, which imports the checkpoint loader,
which is Node — none of which belongs in a Worker. `index.ts` re-exports the
mystery and never the scenario, and `worker/tsconfig.json` excludes
`../lib/**/eval.ts` so the boundary is checked rather than remembered.
