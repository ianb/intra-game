/**
 * Renders the [[colour]] markup the game's static text uses.
 */

import React, { KeyboardEvent, useEffect, useRef } from "react";
import { model } from "./model";
import { useSignals } from "@preact/signals-react/runtime";

export function ColorizedText({ text }: { text: string }) {
  useSignals();
  if (!text) {
    return null;
  }
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const nameRegex = model.world.nameRegex;
  const matches = text.matchAll(nameRegex);
  for (const match of Array.from(matches)) {
    const matchedWord = match[2]!; // This is the captured word from the group
    const matchIndex = match.index! + match[1]!.length; // Adjust index to start of the word

    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // People match by id (their name is their id); rooms match by name, which
    // is not their id ("The Static Garden" vs "Static_Garden"), so fall back to
    // a name lookup to find the colour.
    const ent =
      model.world.getEntity(matchedWord) ??
      Object.values(model.world.entities).find(
        (entity) => entity.name === matchedWord,
      );
    parts.push(
      <span className={ent?.color} key={matchIndex}>
        {matchedWord}
      </span>,
    );

    lastIndex = matchIndex + matchedWord.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return <>{parts}</>;
}
