// Prompt text sent to the image model. This is model-facing, so it is written
// as flat instructions (see CLAUDE.md): say what to draw and what to avoid, no
// rhetorical structure. The entity `description` prose is the author's; it is
// passed through unchanged.

import type { ImageKind } from "./types";

// The one style knob. Changing it changes every image's look, and (via the
// prompt hash) marks every image for regeneration on the next run. Aim: a
// 16-bit indie game, not a smooth pre-rendered scene. The hard pixelation in
// openrouter.ts does the rest.
export const STYLE =
  "Rich, detailed retro pixel art in the style of a 16-bit indie video game. " +
  "Chunky visible pixels on a low-resolution grid, but densely detailed and " +
  "textured: heavy dithering, layered shading, and visible surface texture on " +
  "every material. A bright, saturated, varied palette across warm and cool " +
  "tones. Clear, well-lit scenes. Bold readable shapes, but not flat, not " +
  "minimal, not cartoonish, not a clean mascot look. Not smooth, not " +
  "anti-aliased, not 3D-rendered, not photorealistic. No text, no letters, no " +
  "numbers, no UI, no watermark.";

export function roomPrompt(name: string, description: string): string {
  return [
    STYLE,
    "Draw the interior of a single room as a wide landscape scene that fills " +
      "the frame, viewed at eye level. No people or characters in the frame.",
    `Room name: ${name}.`,
    `Details: ${description}`,
  ].join("\n\n");
}

export function characterPrompt(
  name: string,
  pronouns: string,
  description: string,
): string {
  return [
    STYLE,
    "Draw a square character avatar: one face, head and shoulders, facing " +
      "forward, centered, filling the frame, on a simple flat background.",
    `Name: ${name}. Pronouns: ${pronouns}.`,
    `Appearance: ${description}`,
  ].join("\n\n");
}

// Neutral references, generated once and passed back in as conditioning so the
// per-entity images share a palette and register. Kept generic on purpose: a
// specific room or face here would bend every later image toward it.
export const REFERENCE_PROMPTS: Record<ImageKind, string> = {
  room: [
    STYLE,
    "Draw an empty, generic room interior as a wide landscape scene: plain " +
      "flat walls, a plain floor, one plain doorway. No people, no furniture, " +
      "no text. This is a neutral style and palette reference.",
  ].join("\n\n"),
  character: [
    STYLE,
    "Draw one generic human face avatar, head and shoulders, facing forward, " +
      "centered, on a simple flat background, neutral expression. This is a " +
      "neutral style reference.",
  ].join("\n\n"),
};
