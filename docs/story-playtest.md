# Story implementation and playtest notes

November 11, 2026. Work is local on `codex/story-middle-quests`.

## What changed

The recovery review and the relay decision now have explicit transitions. Model
tags cannot directly assign their outcome fields or mark them solved. The model
interprets a player's intention; the engine checks prerequisites and writes the
result, including the scene, into the same event.

Recovery has an inspectable roster, separate discussion and confirmation, a way
to withdraw consent, standing exemptions, and an unconditional suspension route
after inspection. Only Frida can receive treatment in this review. Her personal
history cutoff and changed trust are replayable; the underlying log is retained.
Showing her preserved letters rebuilds trust without claiming her memories return.

The relay supports releasing the surface day, isolating Intra, and remaining
connected under a local settlement. Flattering or challenging Sentra changes its
recommendation. It cannot operate the cutoff. Ama needs the specific keeper
review before she can do that. The admissions recording supplies an optional
epilogue. The existing competitive tour route remains alongside Marta's guest
route.

## Findings from playing

The engine playthrough started from the existing `briefed` checkpoint and used
the normal input, movement, scheduling, character-response, and reaction paths.
The exploratory checkpoints are `middle-entry` and `middle-walk`.

- Asking to go straight to the Yellow Room failed. The room is several exits
  away, and nearby characters improvised reasons for the failure. Distant travel
  now gives the next room on the actual map.
- The browser and engine had different cuff implementations. Both now use
  `navigate`. Bare `/nav` lists nearby rooms and examples; destinations show a
  concrete walking command. A visible cuff button sits beside the composer.
  Display names such as “The Yellow Room” and “Joyous Café” work. Help and the
  playtest README explain that directions cost no time and people can move.
- `/nav Marta` found her in the Foyer, and walking there reached the confession
  and the garden offer. This is a real navigation/scheduling sample, not a
  claim that every branch has been traversed through the interface.
- The garden introduction appeared twice. Mystery hooks run before the incoming
  event is folded, so an announcement could schedule another copy of itself.
  Incoming transitions now count, and stale queued transitions are discarded.
  Solving a prerequisite can reveal its successor immediately.
- Marta's confession became a generic emotional collapse, including a wrong-room
  description. Her scene now asks for specific behavior with the actual poem and
  explicitly avoids the collapse. Frida's persona similarly favors concrete
  documents over breathless, stammering gratitude. These are writing changes,
  not a guarantee that every generated line is good.
- Re-recording intake exposed a late profession answer being ignored after intake
  ended. Ama now records an explicitly supplied profession at any stage.
- Examining the relay controls produced descriptive prose without recording the
  inspection, and invented an authority override. The general examination prompt
  now explicitly permits required discovery tags. The relay hint distinguishes
  reading the controls from operating them and states the actual authority rules.
- Ama also narrated keeper-duty restoration without recording it. Her hint now
  gives the exact required decision tag and delegates the scene to the engine.
  The evaluator checks the resulting field, not claims made in dialogue.
- The physical-action prompt requested an action description even for a final
  story decision. It now explicitly selects the decision tag instead. The live
  release step then recorded the actual ending rather than only describing one.

## Evidence and limits

`evals/story-path.ts` carries one log through the connected middle, guest route,
recovery review, and surface release. It stages participants in the appropriate
rooms to isolate dialogue and state from travel. It starts after Ink and Echo,
the wake briefing, and archive access. It uses real prompts and model responses,
the tag interpreter, recorded rewards, and mystery progression. Like the engine,
it permits one protocol-correction retry. `--resume` continues a recorded run
without awarding a failed step. The transcript states this scope explicitly.

The initial connected run reached the recovery comparison but emitted its
completion tag before its required performed flag. The evaluator had omitted
the engine's correction retry; it now includes that retry and records attempts.
The staged tour also initially skipped the Hallway visit that reveals the door
mystery. That produced an unbriefed terminal response. The scene setup now records
that waypoint, as actual travel necessarily does, instead of forcing the mystery
state or treating the invented response as lore.

Memory cutoffs count story events rather than local interface messages, so cuff
lookups inserted into a saved transcript cannot expose pre-recovery memories.

`evals/recovery.ts` separately checks hypothetical discussion without consent,
Frida stating her own preference, confirmation of an already requested recovery,
and reintroduction through preserved letters. The first preference check wrongly
required her to accept treatment after an invitation to reconsider. She refused.
The corrected test accepts either definite choice and requires treatment to remain
pending.

Deterministic tests cover the nine combinations of review outcome and settlement,
prerequisite refusal, protected fields, withdrawal, suspension, exemptions,
memory filtering, replay, reintroduction, and preserving completed work. Navigation
tests check actual routes, displayed names, privacy, and zero time/model calls.

Machine checks validate state and protocol. The author should read the actual
scenes and judge the new plot choices and tone. The implementation does not
simulate a playable surface city after the ending; the settlement controls the
epilogue and continuing conversations inside Intra.

Full lint still reports repository-wide shared-preset disagreements, primarily
optional chaining and multiple exports. Focused lint with those rules disabled
checks this work without broad unrelated cleanup. No browser or screen access,
push, or deployment was used for this work.

## Final checks

- 22 of 22 connected staged conversation checks passed after the corrections
  above. See `evals/results/story-path-latest.json` for inputs, responses, and log.
- Four of four isolated recovery checks passed in `recovery-latest.json`.
- The existing competitive Star Citizen evaluation passed all five checks.
- All 457 deterministic assertions pass under Node 22.22.1. Application and
  worker typechecks and the production build pass. The intake cassette was
  refreshed, including the late profession answer.
- Focused lint passes with the two conflicting repository rules disabled;
  full lint remains red (619 errors across the repository). This work does not
  change the shared lint policy.

These are headless checks. Browser layout and a complete unaided human
playthrough of all routes have not been claimed.
