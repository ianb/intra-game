import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { cliChat, DEFAULT_CLI_MODEL } from "../playtest/clichat";
import { openRouterChat } from "./openrouter";
import { INK_AND_ECHO_QUEST, runQuest } from "./quest";
import type { ChatFn } from "../lib/game/model";

/**
 * Let a model play the game and see how far it gets.
 *
 *     pnpm evals:play
 *     pnpm evals:play --player claude-sonnet-4-5-20250929
 *     pnpm evals:play --player openai/gpt-5.2 --backend openrouter
 *
 * `--player` is the model holding the controller; `--model` is the one running
 * the game. They are separate on purpose: "the puzzle is unsolvable" and "this
 * player is bad at adventure games" look identical from one run, and varying
 * them independently is the only way to tell.
 *
 * This is slow and costs real calls — one player call plus several game calls
 * per turn — so it isn't part of `pnpm evals`.
 */

const QUESTS = [INK_AND_ECHO_QUEST];
const RESULTS_DIR = "evals/quests";

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      args[arg.slice(2)] = argv[++i] ?? "";
    }
  }
  return args;
}

function backend(name: string, model: string): ChatFn {
  return name === "openrouter" ? openRouterChat({ model }) : cliChat({ model });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const gameModel = args.model ?? DEFAULT_CLI_MODEL;
  const playerModel = args.player ?? DEFAULT_CLI_MODEL;
  const quest = QUESTS.find((q) => q.name === args.quest) ?? QUESTS[0]!;

  console.log(`\n=== ${quest.name}: ${quest.describe} ===`);
  console.log(`  game:   ${gameModel}`);
  console.log(`  player: ${playerModel}`);
  console.log(
    `  from checkpoint "${quest.from}", up to ${quest.maxTurns} turns\n`,
  );

  const result = await runQuest({
    quest,
    game: backend(args.backend ?? "cli", gameModel),
    player: backend(
      args["player-backend"] ?? args.backend ?? "cli",
      playerModel,
    ),
    gameModel,
    playerModel,
    onTurn: (turn) => {
      console.log(`> ${turn.input}`);
      for (const line of turn.saw.slice(0, 6)) {
        console.log(`    ${line.slice(0, 150).replace(/\n/g, " ")}`);
      }
      for (const milestone of turn.reached) {
        console.log(`    ✓ ${milestone}`);
      }
    },
  });

  console.log(
    `\n${result.solved ? "SOLVED" : "not solved"} in ${result.turns}/${result.maxTurns} turns ` +
      `(${Math.round(result.ms / 1000)}s)`,
  );
  console.log(`  reached: ${result.milestones.join(", ") || "nothing"}`);
  if (result.missed.length) {
    console.log(`  missed:  ${result.missed.join(", ")}`);
  }
  console.log(`  rooms:   ${result.roomsVisited.join(", ")}`);
  if (result.repeats) {
    console.log(`  repeated the same command ${result.repeats} time(s)`);
  }
  if (result.fumbles) {
    console.log(
      `  had to be asked again for a command ${result.fumbles} time(s)`,
    );
  }
  for (const warning of result.dropped.slice(0, 3)) {
    console.log(`  dropped: ${warning.slice(0, 110)}`);
  }
  if (result.error) {
    console.log(`  ERROR ${result.error}`);
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const path = join(RESULTS_DIR, `${quest.name}-${date}.yaml`);
  writeFileSync(path, stringify(result, { lineWidth: 0 }));
  console.log(`\nwrote ${path}`);
}

await main();
