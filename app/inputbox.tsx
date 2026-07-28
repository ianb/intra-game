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
  signIn,
  undoTurn,
} from "./session";
import { model } from "./model";
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
    if (textareaRef.current && !model.runningSignal.value) {
      textareaRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.runningSignal.value]);
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
  });
  async function onSubmit() {
    if (model.runningSignal.value || !can.ok) {
      return;
    }
    if (!textareaRef.current) {
      return;
    }
    const text = textareaRef.current.value;
    if (!text) {
      return;
    }
    let newText = "";
    if (text === "/reset" || text === "/restart") {
      model.reset();
    } else {
      const undoText = await playTurn(text);
      if (typeof undoText === "string") {
        newText = undoText;
      }
    }
    textareaRef.current.value = newText;
    setTimeout(() => {
      textareaRef.current!.focus();
    }, 0);
  }
  async function onUndo(event: React.MouseEvent<HTMLButtonElement>) {
    if (model.runningSignal.value) {
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
  } else if (!model.runningSignal.value) {
    placeholder =
      model.world.lastSuggestions || "ENTER COMMAND OR INSTRUCTIONS";
    if (model.updates.value.length < 7) {
      placeholder =
        "These are just SUGGESTIONS, you can type anything...\n" + placeholder;
    }
  }
  const blocked = !can.ok;
  return (
    <div className="mt-4">
      {blocked && (
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
            (model.runningSignal.value || blocked) && "opacity-50 bg-gray-600",
          )}
          placeholder={placeholder}
          disabled={model.runningSignal.value || blocked}
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
