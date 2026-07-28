/**
 * The app shell: the overall layout, and the overlays that sit on top of it.
 *
 * Each pane lives in its own module — the transcript in ./chatlog, the status
 * strip in ./hud, and so on — with the state they share in ./uistate.
 */

import React, { KeyboardEvent, useEffect, useRef } from "react";
import ScrollOnUpdate from "@/components/scrollonupdate";
import {
  customEndpoint,
  lastLlmError,
  lastLlmErrorType,
  openrouterModel,
} from "@/lib/llm";
import { A, Button, CheckButton } from "@/components/input";
import { ChatLog } from "./chatlog";
import { Controls } from "./controls";
import { HeadsUpDisplay, Time } from "./hud";
import { Help } from "./help";
import { Input } from "./inputbox";
import { Settings } from "./settings";
import { ZoomOverlay } from "@/components/zoom";
import { authState, initSession, loadAuth, playTurn, signIn } from "./session";
import { model } from "./model";
import { openHelp, openSettings, seenHelp, soundOn } from "./uistate";
import { twMerge } from "tailwind-merge";
import { useSignals } from "@preact/signals-react/runtime";

/**
 * Sign in, in the header, where it is visible without provoking an error.
 *
 * Two earlier attempts put this somewhere a signed-out visitor never looked: in
 * Settings, and then on the "no model key" error. Both are places you arrive at
 * only after something has gone wrong or you went looking. A person who lands
 * on a game they could sign into should be able to see that from the game.
 *
 * Nothing renders where signing in isn't possible, so a local-only deployment
 * and a signed-in player both get the header they had before.
 */
function SignInLink() {
  useSignals();
  const auth = authState.value;
  if (!auth?.loginUrl) {
    return null;
  }
  // Signed in, and saying so. Previously the only sign that a login had worked
  // was this button disappearing, which from the player's side is
  // indistinguishable from the click doing nothing at all — the page reloads,
  // the game looks the same, and there is no way to tell success from failure.
  if (auth.email) {
    return (
      <span
        className="text-gray-400 text-sm mr-2 hidden sm:inline"
        title={auth.email}
      >
        {auth.email.split("@")[0]}
      </span>
    );
  }
  return (
    <Button
      className="bg-inherit border border-green-300 rounded-full py-0 px-3 mr-2 text-sm hover:bg-green-600"
      onClick={() => {
        signIn(auth.loginUrl!);
      }}
    >
      Sign in
    </Button>
  );
}

/**
 * The door, for a deployment that has one.
 *
 * Letting a signed-out visitor into the game and then explaining that they need
 * either an account or an OpenRouter key was two ways in and no clear one, and
 * the first thing they met was a failure. Signing in is now the only way in, and
 * bringing your own key is something you can do afterwards if you want to.
 *
 * A deployment with no identity source is unaffected: there is nothing to sign
 * in to, and the game runs in the browser as it always has.
 */
function SignInGate({ children }: { children: React.ReactNode }) {
  useSignals();
  const auth = authState.value;
  // Still asking. Deliberately blank rather than a spinner or the game: showing
  // either would mean showing something that changes a moment later.
  if (!auth) {
    return null;
  }
  if (!auth.loginUrl || auth.email) {
    return <>{children}</>;
  }
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-8">
      <div className="text-2xl mb-2">Intra</div>
      <div className="text-gray-400 mb-8 text-center max-w-md">
        A text adventure in a decaying complex, run by an AI who is very glad
        you asked.
      </div>
      <Button
        className="bg-blue-700 px-6 py-3"
        onClick={() => {
          signIn(auth.loginUrl!);
        }}
      >
        Sign in with Google
      </Button>
      <div className="text-gray-500 text-sm mt-6 text-center max-w-md">
        Games are kept on the server, so they survive closing the tab. Signing
        in is what makes a game yours.
      </div>
    </div>
  );
}

export default function Home() {
  useSignals();
  useEffect(() => {
    // Auth first: what this tab plays depends on whether anyone is signed in,
    // so starting the session before the answer arrives would start the wrong
    // one and then have to undo it.
    void loadAuth().then(() => initSession());
  }, []);
  return (
    <SignInGate>
      <div className="h-screen flex flex-col">
        <div className="bg-gray-800 text-white p-2 fixed w-full top-0 flex justify-between">
          <span className="flex-shrink">
            Intra
            <span className="text-gray-500 text-sm hidden md:inline">
              {" "}
              !alpha: save games will break periodically
            </span>
            <span className="text-gray-500 text-sm md:hidden"> !alpha</span>
          </span>
          <span className="whitespace-nowrap bg-gray-800">
            <SignInLink />
            <Time />
            <Button
              className="bg-inherit border border-green-300 rounded-full py-0 px-3 ml-4 hover:bg-green-600"
              onClick={() => {
                openHelp.value = false;
                openSettings.value = !openSettings.value;
              }}
            >
              ⚙
            </Button>
            <Button
              className={twMerge(
                "bg-inherit py-0 ml-4 px-1 hover:text-cyan-300",
                soundOn.value ? "" : "opacity-25",
              )}
              onClick={() => {
                soundOn.value = !soundOn.value;
              }}
            >
              🔊
            </Button>
            <Button
              className="bg-inherit border border-green-300 rounded-full py-0 px-3 ml-4 hover:bg-green-600"
              onClick={() => {
                openSettings.value = false;
                openHelp.value = !openHelp.value;
              }}
            >
              ?
            </Button>
          </span>
        </div>

        {openHelp.value && (
          <ZoomOverlay
            className="w-3/4 h-3/4"
            onDone={() => {
              openHelp.value = false;
              seenHelp.value = true;
            }}
          >
            <Help />
          </ZoomOverlay>
        )}

        {openSettings.value && (
          <ZoomOverlay
            className="w-3/4 h-3/4"
            onDone={() => {
              openSettings.value = false;
            }}
          >
            <Settings />
          </ZoomOverlay>
        )}

        <div className="flex flex-1 pt-12 md:overflow-hidden flex-col md:flex-row">
          <div className="w-full md:w-2/3 flex flex-col p-4 bg-gray-900 text-white">
            <ScrollOnUpdate
              className="flex-1 overflow-y-auto p-2"
              watch={model.updates.value}
              watch2={lastLlmError.value}
              watch3={model.runningSignal.value}
            >
              <ChatLog />
            </ScrollOnUpdate>
            <Input />
          </div>
          <div className="w-full md:w-1/3 flex flex-col bg-gray-800 text-white h-full">
            <HeadsUpDisplay />
            <Controls />
          </div>
        </div>
      </div>
    </SignInGate>
  );
}
