// globals.css is not imported here: the Tailwind CLI compiles it to
// dist/styles.css, which index.html links directly.
import { createRoot } from "react-dom/client";
import Application from "./application";

// Client entry point. One page: the /openrouter callback route went with the
// browser-side engine, which is the only thing that had a key to receive.

const container = document.getElementById("root");
if (!container) {
  throw new Error("No #root element to mount into");
}
// Note: deliberately not StrictMode. The engine's signal effects are not
// double-invocation safe, and this app never server-renders.
createRoot(container).render(<Application />);
