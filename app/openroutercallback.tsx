import { useSignals } from "@preact/signals-react/runtime";
import { useEffect } from "react";
import { openrouterCode } from "@/lib/llm";

// The page OpenRouter redirects back to after authorizing. It trades the `code`
// query parameter for an API key, stores it, and closes the popup.
export default function OpenRouterCallback() {
  useSignals();
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      return;
    }
    fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
      .then((resp) => resp.json())
      .then((json) => {
        openrouterCode.value = json.key;
        setTimeout(() => {
          window.close();
        }, 3000);
      })
      .catch((e) => {
        console.error("Could not exchange OpenRouter code:", e);
      });
  }, []);
  return <div>Code received, closing window...</div>;
}
