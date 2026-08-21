import { forkGame, settle } from "../playtest/fork";
import { llmPlayer } from "./llmplayer";
import { playerView } from "./playerview";
import { classifyWarnings } from "./harness";
import type { ChatFn, Model } from "../lib/game/model";
import { isStoryActionAttempt, type StoryEventType } from "../lib/types";

/**
 * Can a model *solve* this game, rather than run it?
 *
 * The scenarios elsewhere feed fixed input and check the world moved. A quest
 * hands the game to a model and lets it type whatever it likes until it either
 * gets there or runs out of turns. What that measures is the game, not the
 * model: puzzles here are hand-authored and pass/fail, and the person who wrote
 * one cannot tell whether it is solvable or only solvable in hindsight.
 *
 * Expensive by construction — every player turn is one player call plus several
 * game calls — so quests are short, start from a checkpoint, and are run
 * deliberately rather than as part of `pnpm evals`.
 */

export interface Quest {
  name: string;
  describe: string;
  seed: number;
  /** Where the player starts. Nobody should re-solve intake to reach a puzzle. */
  from: string;
  maxTurns: number;
  /** Reached the goal. Read world state — the player never sees this. */
  solved: (model: Model) => boolean;
  /**
   * Partial credit, in order.
   *
   * A binary solved/not tells you nothing about *where* a player got stuck,
   * which is the whole reason to run this. These are the observable steps along
   * one plausible route.
   */
  milestones: { name: string; reached: (model: Model) => boolean }[];
}

export interface QuestTurn {
  n: number;
  input: string;
  /** The player's notebook at this point — how it understood the game. */
  notes: string;
  /** Something it thought was broken or unguessable; see llmplayer.ts. */
  snag?: string;
  saw: string[];
  /** Milestones true after this turn that weren't before. */
  reached: string[];
  /**
   * The engine's side of the turn: one entry per event, with the raw model
   * response (context steps, minds, attitudes, the tags), the state changes
   * as before=>after lines, and the d20 when one was rolled. The player never
   * sees any of this; it is recorded for the playthrough pages and for
   * debugging a run after the fact.
   */
  machinery?: QuestEventType[];
}

export interface QuestEventType {
  /** Which entity's turn this event was. */
  id: string;
  /** The prompt's title, e.g. "prompt Milton" or "player action". */
  title?: string;
  /** The model's raw response, tags and all. */
  response?: string;
  /** State changes as "Entity.attr: before => after" lines. */
  changes?: string[];
  /** Task-list movement, as "opened: ..." / "completed: ..." lines. */
  todos?: string[];
  /** The d20 shown to the action adjudicator, when this event rolled one. */
  roll?: number;
}

/**
 * The engine's record of one turn, trimmed for the log.
 *
 * The raw llmResponse is kept whole — it is where the judgment machinery
 * lives (the <context> steps, <mind>, <attitude>, the tags) and trimming it
 * would trim exactly what the record is for. Changes become before=>after
 * lines because that is how a human reads them; todaysSchedule is dropped
 * because a regenerated day-plan is a page of noise per character. Events
 * that carry nothing (pure bookkeeping) are dropped whole.
 */
function machineryOf(events: StoryEventType[]): QuestEventType[] {
  return events
    .map((event) => {
      const changes: string[] = [];
      for (const [entityId, change] of Object.entries(event.changes ?? {})) {
        for (const key of Object.keys(change.after ?? {})) {
          if (key === "todaysSchedule") {
            continue;
          }
          const before = JSON.stringify(change.before?.[key]);
          const after = JSON.stringify(change.after[key]);
          if (before !== after) {
            changes.push(`${entityId}.${key}: ${before ?? "unset"} => ${after}`);
          }
        }
      }
      const roll = event.actions
        .filter(isStoryActionAttempt)
        .find((action) => action.roll !== undefined)?.roll;
      const todos = (event.todos ?? []).map(
        (todo) => `${todo.done ? "completed" : "opened"}: ${todo.title}`,
      );
      return {
        id: event.id,
        ...(event.llmTitle ? { title: event.llmTitle } : {}),
        ...(event.llmResponse ? { response: event.llmResponse } : {}),
        ...(changes.length ? { changes } : {}),
        ...(todos.length ? { todos } : {}),
        ...(roll !== undefined ? { roll } : {}),
      };
    })
    .filter(
      (event) =>
        event.response !== undefined ||
        event.changes !== undefined ||
        event.todos !== undefined ||
        event.roll !== undefined,
    );
}

export interface QuestResult {
  quest: string;
  playerModel: string;
  gameModel: string;
  solved: boolean;
  turns: number;
  maxTurns: number;
  milestones: string[];
  /**
   * The task list as the run ended. `authored` marks entries the engine
   * derived from a mystery; the rest were minted by a model during play,
   * which is the population to watch: a minted task that never completes is
   * a red-herring suspect, and the criterion for inventions is that they
   * lead somewhere.
   */
  tasks?: { title: string; done: boolean; authored: boolean }[];
  /** Milestones never reached, in quest order — where it stalled. */
  missed: string[];
  /** Distinct rooms the player stood in. */
  roomsVisited: string[];
  /** Inputs repeated verbatim; a player going in circles. */
  repeats: number;
  /** Turns where the first reply wasn't a command; see llmplayer.ts. */
  fumbles: number;
  /**
   * Every moment the player thought the game was broken or unguessable.
   *
   * The most valuable thing a quest produces, and the reason the player is
   * asked to report rather than only to remember. A run that stalls usually
   * says why here, in the player's own words, which beats reverse-engineering
   * it from a turn log.
   */
  snags: { turn: number; text: string }[];
  dropped: string[];
  ms: number;
  log: QuestTurn[];
  error?: string;
}

/** The Ink and Echo mystery, played rather than scripted. */
export const INK_AND_ECHO_QUEST: Quest = {
  name: "ink-and-echo",
  describe: "find out who is writing the Ink and Echo poems",
  seed: 8080,
  from: "briefed",
  // Raised from 20 after a run ended mid-question to Marta with the whole
  // trail assembled: the funnel now fits, the budget didn't. The confession
  // route runs through her mid-afternoon window, hours of game time from the
  // morning start, so the cap needs room for the wait as well as the walk.
  maxTurns: 32,
  solved: (model) => model.world.entities.Ink_And_Echo.state === "solved",
  milestones: [
    {
      name: "left-the-atrium",
      reached: (model) =>
        model.world.entities.PLAYER.inside !== "Hollow_Atrium",
    },
    {
      // Ama's private hint names Harold and Lily as the last to find notes, so
      // reaching either is the first real step on the intended route.
      name: "met-a-finder",
      reached: (model) => ["Harold", "Lily"].some((id) => hasMet(model, id)),
    },
    {
      name: "met-the-archivist",
      reached: (model) => hasMet(model, "Archivist"),
    },
    { name: "met-marta", reached: (model) => hasMet(model, "Marta") },
    {
      name: "solved",
      reached: (model) => model.world.entities.Ink_And_Echo.state === "solved",
    },
  ],
};

/** Did this character ever speak in the player's presence? */
function hasMet(model: Model, id: string): boolean {
  return model.updates.value.some((event) =>
    event.actions.some(
      (action) => "id" in action && action.id === id && "text" in action,
    ),
  );
}

function captureWarnings(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((a) => String(a)).join(" "));
  };
  return { warnings, restore: () => (console.warn = original) };
}

export async function runQuest({
  quest,
  game,
  player,
  gameModel,
  playerModel,
  onTurn,
}: {
  quest: Quest;
  game: ChatFn;
  player: ChatFn;
  gameModel: string;
  playerModel: string;
  onTurn?: (turn: QuestTurn) => void;
}): Promise<QuestResult> {
  const started = Date.now();
  const captured = captureWarnings();
  const reached = new Set<string>();
  const rooms = new Set<string>();
  const seen = new Set<string>();
  const log: QuestTurn[] = [];
  let repeats = 0;
  let fumbles = 0;
  let error: string | undefined;
  let model: Model | undefined;
  let restore: () => void = () => undefined;

  try {
    const fork = await forkGame({
      chat: game,
      from: quest.from,
      seed: quest.seed,
    });
    model = fork.model;
    restore = fork.restore;
    const nextCommand = llmPlayer(player);
    let cursor = model.updates.value.length;
    rooms.add(model.world.entities.PLAYER.inside);

    for (let n = 1; n <= quest.maxTurns && !quest.solved(model); n++) {
      // Only what happened since the player last looked, so the transcript
      // isn't re-sent whole every turn.
      const view = playerView(model, cursor);
      const { input, notes, snag, fumbled } = await nextCommand(view);
      if (fumbled) {
        fumbles++;
      }
      if (!input) {
        error = "player produced no command";
        break;
      }
      if (seen.has(input)) {
        repeats++;
      }
      seen.add(input);

      cursor = model.updates.value.length;
      await model.sendText(input);
      await settle(model);
      rooms.add(model.world.entities.PLAYER.inside);

      const justReached: string[] = [];
      for (const milestone of quest.milestones) {
        if (!reached.has(milestone.name) && milestone.reached(model)) {
          reached.add(milestone.name);
          justReached.push(milestone.name);
        }
      }
      const turn: QuestTurn = {
        n,
        input,
        notes,
        ...(snag ? { snag } : {}),
        saw: playerView(model, cursor).transcript,
        reached: justReached,
        machinery: machineryOf(model.updates.value.slice(cursor)),
      };
      log.push(turn);
      onTurn?.(turn);
    }
  } catch (e) {
    error = String(e);
  } finally {
    captured.restore();
    restore();
  }

  const solved = model !== undefined && quest.solved(model);
  return {
    quest: quest.name,
    playerModel,
    gameModel,
    solved,
    turns: log.length,
    maxTurns: quest.maxTurns,
    milestones: quest.milestones
      .map((m) => m.name)
      .filter((name) => reached.has(name)),
    tasks:
      model === undefined
        ? []
        : model.world.todos.map((todo) => ({
            title: todo.title,
            done: todo.done,
            authored: todo.from !== undefined,
          })),
    missed: quest.milestones
      .map((m) => m.name)
      .filter((name) => !reached.has(name)),
    roomsVisited: [...rooms],
    repeats,
    fumbles,
    snags: log.flatMap((turn) =>
      turn.snag ? [{ turn: turn.n, text: turn.snag }] : [],
    ),
    dropped: [...new Set(classifyWarnings(captured.warnings).dropped)],
    ms: Date.now() - started,
    log,
    ...(error ? { error } : {}),
  };
}
