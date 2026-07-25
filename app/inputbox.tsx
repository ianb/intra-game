/**
 * The composer: where the player types, and the suggestions the game
 * offers when it has any.
 */

import React, { KeyboardEvent, useEffect, useRef } from "react";
import { A, Button, CheckButton } from "@/components/input";
import { effect, signal, useSignal } from "@preact/signals-react";
import { initSession, playTurn } from "./session";
import { model } from "./model";
import { composer } from "./uistate";
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
  async function onSubmit() {
    if (model.runningSignal.value) {
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
      // Perform the special behavior for shift-click
      await model.redo();
      return;
    }
    const lastInput = model.undo();
    if (lastInput) {
      textareaRef.current!.value = lastInput;
    }
    textareaRef.current!.focus();
  }
  let placeholder = "Waiting...";
  if (!model.runningSignal.value) {
    placeholder =
      model.world.lastSuggestions || "ENTER COMMAND OR INSTRUCTIONS";
    if (model.updates.value.length < 7) {
      placeholder =
        "These are just SUGGESTIONS, you can type anything...\n" + placeholder;
    }
  }
  return (
    <div className="flex mt-4">
      <textarea
        ref={textareaRef}
        rows={2}
        className={twMerge(
          "flex-1 resize-none bg-gray-800 text-white border-none p-2",
          model.runningSignal.value && "opacity-50 bg-gray-600",
        )}
        placeholder={placeholder}
        disabled={model.runningSignal.value}
        onKeyDown={onKeyDown}
      />
      <div className="flex flex-col ml-2">
        <Button className="bg-green-600 text-green-100" onClick={onSubmit}>
          Send
        </Button>
        <Button className="bg-yellow-500 text-yellow-900" onClick={onUndo}>
          Undo
        </Button>
      </div>
    </div>
  );
}
