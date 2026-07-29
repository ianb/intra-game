import { exposeGlobal } from "@/lib/debugglobal";
import { entities } from "@/lib/game/content";
import { Model } from "@/lib/game/model";

// The browser's single game instance.
//
// This deliberately does NOT live in lib/game/model.ts: a module-scope singleton
// is right for a client (one tab, one game) and wrong for a server, where each
// session needs its own Model. Keeping it here means importing the engine has no
// side effects, so a Worker can construct per-session instances instead.
//
// No backend, and none to pass: this instance exists to fold the server's events
// into a world the UI can render. Anything that needs a model goes through /api,
// where the engine lives. It used to need an explicit thrower here, because a
// Model with no `chat` fell back to a browser OpenRouter client; that client is
// gone, and a Model without a backend now refuses on its own.
export const model = new Model(entities);

exposeGlobal("model", model);
