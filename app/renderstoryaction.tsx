import React from "react";
import { WithBlinkingCursor } from "@/components/input";
import { ArchivistRoom, Room } from "@/lib/game/classes";
import {
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
  StoryActionType,
  StoryEventType,
} from "@/lib/types";

// View-side rendering of a story action. This is the presentation counterpart
// to the engine's action model, which lives entirely in lib/ and knows nothing
// about React. Base rendering is plain text; the Archivist console gets its
// terminal-style typewriter treatment.
export function renderStoryAction(
  room: Room,
  storyEvent: StoryEventType,
  action: StoryActionType,
): React.ReactNode {
  if (room instanceof ArchivistRoom) {
    const archived = renderArchivistAction(storyEvent, action);
    if (archived !== undefined) {
      return archived;
    }
  }
  return renderBaseAction(action);
}

function renderBaseAction(action: StoryActionType): React.ReactNode {
  if (isStoryDialog(action)) {
    const text = action.text.replace(/^"*/, "").replace(/"*$/, "");
    return `"${text}"`;
  } else if (isStoryDescription(action)) {
    return action.text;
  } else if (isStoryActionAttempt(action)) {
    return action.attempt + "\n\n" + action.resolution;
  }
  return undefined;
}

function renderArchivistAction(
  storyEvent: StoryEventType,
  action: StoryActionType,
): React.ReactNode | undefined {
  if (isStoryDialog(action)) {
    if (
      !action.toId ||
      action.toId === "PLAYER" ||
      action.toId === "Archivist"
    ) {
      if (storyEvent.id === "PLAYER") {
        return <WithBlinkingCursor>{action.text}</WithBlinkingCursor>;
      }
      const text = action.text
        .trim()
        .replace(/^`+/, "")
        .replace(/`+$/, "")
        .trim();
      // non-breaking space is deliberate: it indents the Archivist console's
      // output without collapsing in the <pre> the transcript renders into.
      // eslint-disable-next-line no-irregular-whitespace -- the leading
      return ` ${text}`;
    }
  }
  return undefined;
}
