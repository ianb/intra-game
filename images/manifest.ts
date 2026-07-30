// Read/write the committed image manifest. The manifest is the single source of
// truth for "which entities have an image and where"; the view side imports the
// same JSON (app/images.ts).

import { readFileSync, writeFileSync } from "node:fs";
import type { ImageManifest } from "./types";

export function loadManifest(path: string): ImageManifest {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ImageManifest;
  } catch {
    // Missing or unreadable: start fresh. The file is regenerated on save.
    return { version: 1, style: "", entries: {} };
  }
}

export function saveManifest(path: string, manifest: ImageManifest): void {
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
}
