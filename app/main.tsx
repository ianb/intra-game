// globals.css is not imported here: the Tailwind CLI compiles it to
// dist/styles.css, which index.html links directly.
import { createRoot } from "react-dom/client";
import Application from "./application";
import OpenRouterCallback from "./openroutercallback";

// Client entry point. The game is a single-page app with two routes, so routing
// is just a path check — no router library, and no server involvement. The
// Cloudflare static-asset config serves index.html for both paths.
function Route() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/openrouter") {
    return <OpenRouterCallback />;
  }
  return <Application />;
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("No #root element to mount into");
}
// Note: deliberately not StrictMode. The engine's signal effects are not
// double-invocation safe, and this app never server-renders.
createRoot(container).render(<Route />);
