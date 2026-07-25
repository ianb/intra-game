import { model as gameModel } from "@/lib/game/model";
import type { Model } from "@/lib/game/model";
import { listSaves, load, removeSave, save } from "./localsaves";

// Saved games in browser storage. This is a client concern — the engine must
// stay free of browser APIs so it can run server-side, where a session's log is
// held by the server instead. Kept here rather than on Model for that reason.

export interface SaveListType {
  title: string;
  slug: string;
  date: string;
}

export function proposeSaveTitle(model: Model = gameModel): string {
  return `${model.world.entities.player.name} ${formatDate(new Date())}`;
}

export function saveGame(title: string, model: Model = gameModel): void {
  save(title, model.updates.value);
}

export function loadGame(slug: string, model: Model = gameModel): void {
  model.replaceLog(load(slug));
}

export function listSavedGames(): SaveListType[] {
  return listSaves().map((s) => ({
    title: s.title,
    slug: s.slug,
    date: formatDate(s.date),
  }));
}

export function removeSavedGame(slug: string): void {
  removeSave(slug);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
