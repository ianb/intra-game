/**
 * View state shared across the app's panes.
 *
 * These are plain module-scope signals rather than React state: the panes that
 * read them are siblings, not a tree, and threading props through Home to reach
 * a toggle in the settings overlay would be worse than a module. They are view
 * concerns only — nothing here belongs to the engine, whose state is the event
 * log.
 */

import React, { KeyboardEvent, useEffect, useRef } from "react";
import { effect, signal, useSignal } from "@preact/signals-react";
import { persistentSignal } from "@/lib/persistentsignal";
import { soundtrackPlayer } from "./soundtrack";

export const activeTab = persistentSignal("activeTab", "map");
export const showInternals = persistentSignal("showInternals", false);
export const revealMap = persistentSignal("revealMap", false);
export const seenHelp = persistentSignal("seenHelp", false);
export const soundOn = signal(false);

effect(() => {
  const s = soundOn.value;
  if (s) {
    soundtrackPlayer.unpause();
  } else {
    soundtrackPlayer.pause();
  }
});

/**
 * The composer's textarea, so the controls can type an NPC's name into it.
 *
 * A holder rather than the ref itself: Input owns the ref and assigns it on
 * mount, and an imported binding can't be reassigned.
 */
export const composer: { ref: React.RefObject<HTMLTextAreaElement> | null } = {
  ref: null,
};
export const openSettings = signal(false);
export const openHelp = signal(!seenHelp.value);

/**
 * The last thing that went wrong with a turn, shown above the composer.
 *
 * This lived in lib/llm.ts, next to the browser's OpenRouter client that set
 * it. That client is gone — the engine runs on the server and a turn is a
 * request — so the only thing left is the message, and it is view state like
 * everything else here.
 */
export const lastLlmError = signal<string | null>(null);
