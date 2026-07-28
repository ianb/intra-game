import { exposeGlobal } from "@/lib/debugglobal";
import { entities } from "@/lib/game/content";
import { Model } from "@/lib/game/model";

// The browser's single game instance.
//
// This deliberately does NOT live in lib/game/model.ts: a module-scope singleton
// is right for a client (one tab, one game) and wrong for a server, where each
// session needs its own Model. Keeping it here means importing the engine has no
// side effects, so a Worker can construct per-session instances instead.
export const model = new Model(entities, {
  // The view never calls a model.
  //
  // The engine defaults to lib/llm's browser client, which means a component
  // could reach a provider by accident — and for a while the browser did play
  // whole games that way, on the player's own key, next to a server that plays
  // them properly. Two engines, two sets of rules, and a key that meant
  // something different depending on which one you were in.
  //
  // This instance exists to fold the server's events into a world the UI can
  // render. Anything that needs a model goes through /api, where the engine
  // lives. Throwing rather than omitting it: a silent no-op would be a turn
  // that vanishes.
  chat: () => {
    throw new Error(
      "The browser does not run the engine — send the turn to /api/input.",
    );
  },
});

exposeGlobal("model", model);
