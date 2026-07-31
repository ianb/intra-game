/**
 * Room and character images, generated offline (see images/) and committed
 * under app/assets/images/. This is the view-side lookup: given an entity id,
 * the URL of its image, or nothing if it has none. Like soundtrack.ts, showing
 * an image is a browser concern kept out of the engine.
 *
 * The manifest is bundled (not fetched) so the lookup is synchronous and can be
 * read straight from a render, with no loading state to thread through.
 */

import type { ImageManifest } from "@/images/types";
import manifestJson from "./assets/images/manifest.json";

const manifest = manifestJson as ImageManifest;

export function imageForEntity(id: string): string | undefined {
  const entry = manifest.entries[id];
  return entry ? `/assets/images/${entry.file}` : undefined;
}
