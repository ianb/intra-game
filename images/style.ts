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
  "Retro pixel art in the style of a 16-bit indie video game. Chunky visible " +
  "pixels, a small bright saturated palette, bold clean shapes, strong " +
  "readable silhouettes, simple flat shading. Hand-drawn on a low-resolution " +
  "pixel grid. Not smooth, not anti-aliased, not 3D-rendered, not " +
  "photorealistic. No text, no letters, no numbers, no UI, no watermark.";

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
    // The uniform is worldbuilding: one suit for every citizen, in the
    // retro-futurist bunker tradition without copying any existing game's.
    // Pinned to specific colors so the cast reads as wearing the same issue
    // rather than coincidentally similar clothes.
    "Clothing: a standard-issue utility jumpsuit, the same for every " +
      "citizen: mustard-yellow, with a dark teal collar and shoulder yoke " +
      "and a sturdy front zip, mid-century atomic-age bunker wear. The " +
      "collar and shoulders are visible in the crop. The appearance below " +
      "describes how this character wears and keeps their suit.",
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
