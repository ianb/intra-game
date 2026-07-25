import { entities } from "@/lib/game/gameobjs";
import { Model } from "@/lib/game/model";

// The browser's single game instance.
//
// This deliberately does NOT live in lib/game/model.ts: a module-scope singleton
// is right for a client (one tab, one game) and wrong for a server, where each
// session needs its own Model. Keeping it here means importing the engine has no
// side effects, so a Worker can construct per-session instances instead.
export const model = new Model(entities);

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).model = model;
}
