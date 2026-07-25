/**
 * The settings overlay: model choice, the OpenRouter key, and the log.
 */

import { useEffect } from "react";
import { twMerge } from "tailwind-merge";
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
import {
  deleteServerSession,
  listServerSessions,
  newServerSession,
  remoteSession,
  type ServerSession,
} from "./session";
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
        Playing on the server.
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
        <ServerGames />
      </>
    );
  }
  return (
    <>
      Playing in this tab, using your own model access.
      <br />
      <Button
        className="mt-2"
        onClick={async () => {
          // Ask the server for a game rather than inventing an id here, so it
          // is on the player's list from the start.
          try {
            const created = await newServerSession();
            remoteSession.value = created.id;
          } catch {
            // No index (an older deployment, or the API is unreachable) — an
            // id still addresses a session perfectly well, so play anyway.
            remoteSession.value = crypto.randomUUID();
          }
          window.location.reload();
        }}
      >
        Play on the server (reloads)
      </Button>
    </>
  );
}

/**
 * The player's games on the server: switch between them, start one, delete one.
 *
 * Server games are the saves in this mode — the log lives on the server, so
 * "save" and "have several" are the same feature, and this is where both
 * happen.
 */
function ServerGames() {
  useSignals();
  const games = useSignal<ServerSession[] | null>(null);
  const error = useSignal("");
  const busy = useSignal(false);
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function refresh() {
    try {
      games.value = await listServerSessions();
      error.value = "";
    } catch (e) {
      games.value = [];
      error.value = String(e);
    }
  }
  async function withBusy(fn: () => Promise<void>) {
    busy.value = true;
    try {
      await fn();
      error.value = "";
    } catch (e) {
      error.value = String(e);
    } finally {
      busy.value = false;
    }
  }
  if (games.value === null) {
    return <div className="mt-4 text-sm text-gray-300">Loading games…</div>;
  }
  return (
    <div className="mt-4">
      <div className="mb-1">Your games</div>
      {error.value && (
        <div className="text-sm text-red-300 mb-1">{error.value}</div>
      )}
      {games.value.map((game) => {
        const current = game.id === remoteSession.value;
        return (
          <div key={game.id} className="mb-1 flex items-center">
            <Button
              className={twMerge(
                "text-sm mr-1",
                current && "bg-green-700 text-white",
              )}
              disabled={busy.value || current}
              onClick={() => {
                remoteSession.value = game.id;
                window.location.reload();
              }}
            >
              {game.title}
            </Button>
            <span className="text-xs text-gray-300 mr-1">
              {game.events} events · {game.created}
              {current ? " · playing" : ""}
            </span>
            <Button
              className="text-xs bg-red-800 text-white hover:bg-red-600"
              disabled={busy.value}
              onClick={() =>
                withBusy(async () => {
                  await deleteServerSession(game.id);
                  if (current) {
                    window.location.reload();
                    return;
                  }
                  await refresh();
                })
              }
            >
              🗑️
            </Button>
          </div>
        );
      })}
      <Button
        className="text-sm mt-1"
        disabled={busy.value}
        onClick={() =>
          withBusy(async () => {
            const created = await newServerSession();
            remoteSession.value = created.id;
            window.location.reload();
          })
        }
      >
        New game on the server
      </Button>
    </div>
  );
}
