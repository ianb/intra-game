/**
 * The settings overlay: model choice, the OpenRouter key, and the log.
 */

import {
  customEndpoint,
  lastLlmError,
  lastLlmErrorType,
  openrouterModel,
} from "@/lib/llm";
import { A, Button, CheckButton } from "@/components/input";
import { ModelSelector } from "@/components/modelselector";
import { effect, signal, useSignal } from "@preact/signals-react";
import { model } from "./model";
import { openrouterCode, OpenRouterConnect } from "@/components/openrouter";
import { useSignals } from "@preact/signals-react/runtime";

export function Settings() {
  useSignals();
  return (
    <div className="w-full h-full bg-blue-900 text-white py-4 px-8 border-white border-8 overflow-scroll flex flex-col">
      <div className="flex justify-center mb-4">Settings</div>
      <div className="flex-1 overflow-y-auto">
        <div>
          Choose a model:
          <br />
          <ModelSelector
            signal={openrouterModel}
            freeOnly={!openrouterCode.value}
          />
        </div>
        <div className="mt-4">
          {openrouterCode.value ? (
            <>
              You have a code from{" "}
              <A href="https://openrouter.ai/keys" blank>
                OpenRouter.ai
              </A>
              : <br />
              <code>
                {openrouterCode.value.slice(0, 12)}...
                {openrouterCode.value.slice(-3)}
              </code>
              <Button
                className="ml-4"
                onClick={() => {
                  openrouterCode.value = null;
                }}
              >
                Remove code
              </Button>
            </>
          ) : (
            <>
              <div className="mb-4">
                To have access to paid models you can get a code from{" "}
                <A href="https://openrouter.ai/" blank>
                  OpenRouter.ai
                </A>
              </div>
              <div>
                <OpenRouterConnect />
              </div>
            </>
          )}
        </div>
        <div className="mt-4">
          Set a custom endpoint: <br />
          <input
            type="text"
            className="bg-gray-800 text-white p-2 w-2/3"
            value={customEndpoint.value || ""}
            onInput={(e) => {
              customEndpoint.value = (e.target as HTMLInputElement).value;
            }}
            placeholder="http://localhost:5001/v1"
          />
        </div>
      </div>
      <div className="flex justify-center">
        <span className="done bg-green-800 hover:bg-green-600 cursor-pointer px-4">
          DONE
        </span>
      </div>
    </div>
  );
}

const CLOCK_CHARS: Record<string, string> = {
  "12": "🕛",
  "1": "🕐",
  "2": "🕑",
  "3": "🕒",
  "4": "🕓",
  "5": "🕔",
  "6": "🕕",
  "7": "🕖",
  "8": "🕗",
  "9": "🕘",
  "10": "🕙",
  "11": "🕚",
};
