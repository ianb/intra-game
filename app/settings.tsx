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
import { remoteSession } from "./session";
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
          <ServerPlay />
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

/**
 * Switch between playing in this tab and playing on the server.
 *
 * Local play runs the engine here against the player's own OpenRouter key.
 * Server play runs it in a Durable Object: the key is the server's, the event
 * log outlives the browser, and this tab is only a renderer. The session id is
 * the player's — it is scoped to their verified identity server-side, so it
 * names their own session and nobody else's.
 *
 * Switching reloads, because which mode a tab is in is decided once when the
 * game starts: the local path launches the game here and the remote path adopts
 * the server's log, and doing both would double the events.
 */
function ServerPlay() {
  useSignals();
  const session = remoteSession.value;
  if (session) {
    return (
      <>
        Playing on the server, session <code>{session.slice(0, 8)}</code>
        <br />
        <Button
          className="mt-2"
          onClick={() => {
            remoteSession.value = null;
            window.location.reload();
          }}
        >
          Play in this tab instead
        </Button>
      </>
    );
  }
  return (
    <>
      Playing in this tab, using your own model access.
      <br />
      <Button
        className="mt-2"
        onClick={() => {
          remoteSession.value = crypto.randomUUID();
          window.location.reload();
        }}
      >
        Play on the server (reloads)
      </Button>
    </>
  );
}
