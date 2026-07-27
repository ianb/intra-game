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
import { initSession, loadAuth, playTurn } from "./session";
import { model } from "./model";
import { openHelp, openSettings, seenHelp, soundOn } from "./uistate";
import { twMerge } from "tailwind-merge";
import { useSignals } from "@preact/signals-react/runtime";

export default function Home() {
  useSignals();
  useEffect(() => {
    // Both at startup: the session decides what this tab plays, and the auth
    // state decides what to offer when it can't play anything.
    void loadAuth();
    void initSession();
  }, []);
  return (
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
  );
}
