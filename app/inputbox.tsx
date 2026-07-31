/**
 * The composer: where the player types, and the suggestions the game
 * offers when it has any.
 */

import React, { KeyboardEvent, useEffect, useRef } from "react";
import { A, Button, CheckButton } from "@/components/input";
import { effect, signal, useSignal } from "@preact/signals-react";
import {
  authState,
  initSession,
  playable,
  playTurn,
  redoTurn,
  remoteSession,
  sessionStatus,
  signIn,
  startNewGame,
  turnRunning,
  undoTurn,
} from "./session";
import { model } from "./model";
import { teleport } from "./teleport";
import { composer, openSettings } from "./uistate";
import { twMerge } from "tailwind-merge";
import { useSignals } from "@preact/signals-react/runtime";

export function Input() {
  useSignals();
  // FIX for a lack of using a signal for model.lastSuggestions
  const _v = model.updates.value;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  composer.ref = textareaRef;
  useEffect(() => {
    if (textareaRef.current && !turnRunning.value) {
      textareaRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnRunning.value]);
  async function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }
  const can = playable({
    auth: authState.value,
    session: remoteSession.value,
    status: sessionStatus.value,
  });
  async function onSubmit() {
    if (turnRunning.value || !can.ok) {
      return;
    }
    if (!textareaRef.current) {
      return;
    }
    const text = textareaRef.current.value;
    if (!text) {
      return;
    }
    // Cleared before the turn, not after it. This used to wait for the whole
    // turn to finish, so pressing enter left the text sitting there and looked
    // like nothing had happened for as long as the model took.
    textareaRef.current.value = "";
    if (text === "/reset" || text === "/restart") {
      // Not model.reset(): that empties this tab's copy of the world and asks
      // the engine to launch a game here, which is neither where the engine is
      // nor where the game is.
      await startNewGame();
    } else if (text === "/teleport" || text.startsWith("/teleport ")) {
      // Dev command for previewing rooms and character art; see app/teleport.ts.
      teleport(text.slice("/teleport".length));
    } else {
      try {
        await playTurn(text);
      } catch {
        // A turn that never happened — a refusal, a provider error — shouldn't
        // also cost the player what they typed. The error itself is already on
        // screen; this just gives them their words back to send again.
        if (textareaRef.current && !textareaRef.current.value) {
          textareaRef.current.value = text;
        }
      }
    }
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }
  async function onUndo(event: React.MouseEvent<HTMLButtonElement>) {
    if (turnRunning.value) {
      return;
    }
    if (event.shiftKey) {
      // Shift-click undoes and replays, for when the model just needs another go.
      await redoTurn();
      return;
    }
    const lastInput = await undoTurn();
    if (lastInput) {
      textareaRef.current!.value = lastInput;
    }
    textareaRef.current!.focus();
  }
  let placeholder = "Waiting...";
  if (!can.ok) {
    placeholder = can.why;
  } else if (!turnRunning.value) {
    placeholder =
      model.world.lastSuggestions || "ENTER COMMAND OR INSTRUCTIONS";
    if (model.updates.value.length < 7) {
      placeholder =
        "These are just SUGGESTIONS, you can type anything...\n" + placeholder;
    }
  }
  const blocked = !can.ok;
  // Buttons only for something the player can do something about. While the
  // game is still loading there is nothing to offer, and "Open settings" beside
  // "Loading your game..." reads as a problem rather than a wait.
  return (
    <div className="mt-4">
      {blocked && !can.waiting && (
        <div className="flex gap-2 mb-2">
          {can.loginUrl && (
            <Button
              className="bg-blue-700"
              onClick={() => {
                signIn(can.loginUrl!);
              }}
            >
              Sign in with Google
            </Button>
          )}
          <Button
            onClick={() => {
              openSettings.value = true;
            }}
          >
            ⚙ {can.loginUrl ? "Or use your own key" : "Open settings"}
          </Button>
        </div>
      )}
      <div className="flex">
        <textarea
          ref={textareaRef}
          rows={2}
          className={twMerge(
            "flex-1 resize-none bg-gray-800 text-white border-none p-2",
            (turnRunning.value || blocked) && "opacity-50 bg-gray-600",
          )}
          placeholder={placeholder}
          disabled={turnRunning.value || blocked}
          onKeyDown={onKeyDown}
        />
        <div className="flex flex-col ml-2">
          <Button
            className={twMerge(
              "bg-green-600 text-green-100",
              blocked && "opacity-50",
            )}
            disabled={blocked}
            onClick={onSubmit}
          >
            Send
          </Button>
          <Button className="bg-yellow-500 text-yellow-900" onClick={onUndo}>
            Undo
          </Button>
        </div>
      </div>
    </div>
  );
}
