/**
 * The settings overlay: your games on the server, what they have cost, and
 * which build this is.
 *
 * It used to configure an LLM client that ran in this tab — a model, an
 * OpenRouter key, a custom endpoint. The engine lives on the server, so those
 * are the server's settings, and a view offering them was offering to configure
 * something it does not own.
 */

import { useEffect } from "react";
import { Costs } from "./costs";
import { A, Button } from "@/components/input";
import { useSignal } from "@preact/signals-react";
import { twMerge } from "tailwind-merge";
import {
  authState,
  deleteServerSession,
  listServerSessions,
  newServerSession,
  remoteSession,
  signIn,
  signOut,
  type AuthState,
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
          <ServerPlay />
          <Costs />
        </div>

        {/* Choosing a model, supplying a key and pointing at an endpoint were
            all here, and all of them configured an LLM client that ran in this
            tab. The engine lives on the server now, so those are the server's
            settings — a view offering them would be offering to configure
            something it doesn't own. */}
      </div>
      <BuildVersion />
      <div className="flex justify-center">
        <span className="done bg-green-800 hover:bg-green-600 cursor-pointer px-4">
          DONE
        </span>
      </div>
    </div>
  );
}

/**
 * Which build this page is, and whether the server has a newer one.
 *
 * Two different things look identical from a browser: a deploy that hasn't
 * finished, and a deploy that has, with the tab still running a cached bundle.
 * They want opposite responses — wait, versus reload — so this compares the
 * bundle's own stamp against what the server is currently serving and says
 * which of the two it is.
 */
function BuildVersion() {
  useSignals();
  const server = useSignal<string | null>(null);
  useEffect(() => {
    void fetch(`/version.json?t=${Date.now()}`, {
      headers: { "cache-control": "no-cache" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: { sha?: string } | null) => {
        server.value = v?.sha ?? null;
      })
      .catch(() => {
        server.value = null;
      });
  }, [server]);
  const stale = server.value && server.value !== __BUILD_SHA__;
  return (
    <div className="text-xs text-gray-400 text-center mt-4">
      build {__BUILD_SHA__}
      {stale && (
        <>
          {" — the server has "}
          {server.value}.{" "}
          <A
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </A>
        </>
      )}
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
  const auth = authState;
  const session = remoteSession.value;

  // Nothing to offer: this deployment has no server to play on.
  if (auth.value?.mode === "none") {
    return <>Playing in this tab, using your own model access.</>;
  }
  // Signed out where signing in is possible. Deliberately the only thing shown:
  // starting a server game while signed out fails at the first request, and an
  // enabled button that 401s is worse than one that isn't there.
  if (auth.value && !auth.value.email && auth.value.loginUrl) {
    return (
      <>
        Playing in this tab, using your own model access.
        <div className="mt-2 text-sm">
          Sign in to keep games on the server, where they outlive this browser.
        </div>
        <Button
          className="mt-2"
          onClick={() => {
            signIn(auth.value!.loginUrl!);
          }}
        >
          Sign in with Google
        </Button>
      </>
    );
  }
  if (session) {
    return (
      <>
        Playing on the server.
        <SignedInAs auth={auth.value} />
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
      <SignedInAs auth={auth.value} />
    </>
  );
}

/**
 * Who you're signed in as, and how to stop being.
 *
 * Only shown where signing out is a thing the player can do. Under Access the
 * session belongs to Cloudflare rather than to us, so a sign-out button here
 * would clear a cookie we didn't set and leave them signed in anyway.
 */
function SignedInAs({ auth }: { auth: AuthState | null }) {
  if (!auth?.email || auth.mode !== "google") {
    return null;
  }
  return (
    <div className="mt-2 text-sm text-gray-300">
      Signed in as {auth.email}.{" "}
      <A
        onClick={() => {
          signOut();
        }}
      >
        Sign out
      </A>
    </div>
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
