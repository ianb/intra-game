import { persistentSignal } from "@/lib/persistentsignal";
import { useSignals } from "@preact/signals-react/runtime";
import { useEffect } from "react";

const thisOrigin = typeof window !== "undefined" ? window.location.origin : "";

const OPENROUTER_ENDPOINT = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(
  thisOrigin
)}/openrouter`;

export const openrouterCode = persistentSignal<string | null>(
  "openrouterCode",
  null
);

export function OpenRouterConnect() {
  useSignals();
  const _code = openrouterCode.value;
  useEffect(() => {
    const code = setInterval(() => {
      (openrouterCode as any).refresh();
    }, 100);
    return () => {
      clearInterval(code);
    };
  });
  return (
    <a
      href={OPENROUTER_ENDPOINT}
      className="bg-green-600 text-white p-2"
      target="_blank"
      onClick={(event) => {
        // use window.open if we can...
        if (typeof window !== "undefined") {
          window.open(OPENROUTER_ENDPOINT, "_blank");
        }
        event.preventDefault();
      }}
    >
      Connect to OpenRouter
    </a>
  );
}
