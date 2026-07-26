import { forkGame, settle } from "../playtest/fork";
import { llmPlayer } from "./llmplayer";
import { playerView } from "./playerview";
import { classifyWarnings } from "./harness";
import type { ChatFn, Model } from "../lib/game/model";

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
  saw: string[];
  /** Milestones true after this turn that weren't before. */
  reached: string[];
}

export interface QuestResult {
  quest: string;
  playerModel: string;
  gameModel: string;
  solved: boolean;
  turns: number;
  maxTurns: number;
  milestones: string[];
  /** Milestones never reached, in quest order — where it stalled. */
  missed: string[];
  /** Distinct rooms the player stood in. */
  roomsVisited: string[];
  /** Inputs repeated verbatim; a player going in circles. */
  repeats: number;
  /** Turns where the first reply wasn't a command; see llmplayer.ts. */
  fumbles: number;
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
  maxTurns: 20,
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
      const { input, fumbled } = await nextCommand(view);
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
        saw: playerView(model, cursor).transcript,
        reached: justReached,
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
    missed: quest.milestones
      .map((m) => m.name)
      .filter((name) => !reached.has(name)),
    roomsVisited: [...rooms],
    repeats,
    fumbles,
    dropped: [...new Set(classifyWarnings(captured.warnings).dropped)],
    ms: Date.now() - started,
    log,
    ...(error ? { error } : {}),
  };
}
