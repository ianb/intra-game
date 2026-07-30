// Shared types for the image pipeline. No imports, so both the Node generator
// (images/generate.ts) and the view-side lookup (app/images.ts) can depend on
// it without pulling code across the runtime boundary.

export type ImageKind = "room" | "character";

export interface ImageEntry {
  kind: ImageKind;
  // Path relative to /assets/images/, e.g. "rooms/Intake.webp".
  file: string;
  // Short hash of (model + prompt). If it changes, the image is regenerated.
  promptHash: string;
  model: string;
  // ISO date the image was generated.
  generated: string;
}

export interface ImageManifest {
  version: number;
  // The style prompt in force when the images were generated, for reference.
  style: string;
  // Keyed by entity id.
  entries: Record<string, ImageEntry>;
}
