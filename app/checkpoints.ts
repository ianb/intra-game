import { model as gameModel } from "./model";
import { migratePlayerId } from "@/lib/game/migrate";
import { proposeSaveTitle, saveGame } from "./saves";
import type { Model } from "@/lib/game/model";
import type { StoryEventType } from "@/lib/types";

/**
 * Starting the browser game from a recorded checkpoint.
 *
 * The CLI has had this for a while — `pnpm playtest --from briefed` — and it is
 * the difference between looking at the opening five minutes of the game and
 * looking at any of it. The same states are now shipped into `dist/checkpoints/`
 * by the build, so a link can put someone directly into the middle of the game:
 *
 *     /?checkpoint=briefed
 *
 * which is how to hand someone a specific thing to look at, rather than a game
 * and a paragraph of instructions for reaching the interesting part.
 *
 * A checkpoint is an event log and loading one is `replaceLog`, exactly like
 * loading a save — there is no separate "preview mode" for the state to be
 * wrong in.
 */

export interface CheckpointSummary {
  name: string;
  describe: string;
  recorded: string;
  model: string;
  events: number;
}

/**
 * What's available, or [] if this build shipped without any.
 *
 * Absent checkpoints are not an error: the game is playable without them, and
 * a 404 here should not break the load menu.
 */
export async function listCheckpoints(): Promise<CheckpointSummary[]> {
  try {
    const response = await fetch("/checkpoints/index.json");
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as CheckpointSummary[];
  } catch {
    return [];
  }
}

/**
 * Replace the current game with a checkpoint.
 *
 * The game in progress is saved first, unless there's nothing in it. Following
 * a link must not be how someone loses their game — and because a checkpoint is
 * loaded through the ordinary save machinery, the way back is the ordinary load
 * menu rather than anything special.
 */
export async function loadCheckpoint(
  name: string,
  model: Model = gameModel,
): Promise<void> {
  const response = await fetch(`/checkpoints/${encodeURIComponent(name)}.json`);
  if (!response.ok) {
    throw new Error(`No checkpoint "${name}" in this build`);
  }
  const checkpoint = (await response.json()) as { events: StoryEventType[] };
  // More than the launch event means there is a game here worth keeping.
  if (model.updates.value.length > 1) {
    saveGame(`${proposeSaveTitle(model)} (before ${name})`, model);
  }
  model.replaceLog(migratePlayerId(checkpoint.events));
}

/** The checkpoint named in the URL, if the page was opened with one. */
export function checkpointFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("checkpoint");
}
