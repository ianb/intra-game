// Generate room and character images with Gemini 2.5 Flash Image ("Nano
// Banana") through OpenRouter, and commit them as WebP under app/assets/images/.
//
// This is offline authoring, like recording checkpoints: the runtime never
// calls the image API, it just loads the committed files. Regeneration is
// driven by a prompt hash, so editing a description or the style re-makes only
// what changed.
//
//   pnpm images                 generate images that are missing or out of date
//   pnpm images --force         regenerate everything
//   pnpm images Intake Marta    only these entity ids
//   pnpm images --kind room     only rooms (or --kind character)
//   pnpm images --refs          (re)generate the two neutral reference images
//
// Needs OPENROUTER_API_KEY. Optional: IMAGE_MODEL, IMAGE_SIZE, IMAGE_QUALITY.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { entities } from "../lib/game/content";
import { isPerson, isRoom } from "../lib/types";
import { generateImage, pngToWebp, webpToPng } from "./openrouter";
import { loadManifest, saveManifest } from "./manifest";
import {
  STYLE,
  characterPrompt,
  roomPrompt,
  REFERENCE_PROMPTS,
} from "./style";
import type { ImageKind } from "./types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGES_DIR = resolve(root, "app/assets/images");
const MANIFEST_FILE = resolve(IMAGES_DIR, "manifest.json");

const MODEL = process.env.IMAGE_MODEL ?? "google/gemini-2.5-flash-image";
const QUALITY = Number(process.env.IMAGE_QUALITY ?? 90);

const KIND_DIR: Record<ImageKind, string> = {
  room: "rooms",
  character: "characters",
};

// The pixel grid each kind is stored at. Small on purpose: this is the chunky
// retro resolution, upscaled crisply at display time (image-rendering:
// pixelated). Rooms are landscape, characters are square avatars.
const KIND_DIMS: Record<ImageKind, { width: number; height: number }> = {
  room: { width: 320, height: 180 },
  character: { width: 128, height: 128 },
};

interface Target {
  id: string;
  kind: ImageKind;
  prompt: string;
}

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return key;
}

function shortHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function kb(buffer: Buffer): string {
  return `${Math.round(buffer.length / 1024)}KB`;
}

// Entities that shouldn't get an image. The player has no fixed face; the
// narrator and Ama (the facility's disembodied AI) have no body; the Archivist
// is a terminal, not a person to portrait; the Void is a holding area, not a
// place. Skip them so a bare `description` doesn't mint an odd image.
const SKIP_IDS = new Set(["PLAYER", "Ama", "narrator", "Archivist", "Void"]);

function collectTargets(): Target[] {
  const targets: Target[] = [];
  for (const entity of Object.values(entities)) {
    if (SKIP_IDS.has(entity.id)) {
      continue;
    }
    if (isRoom(entity) && entity.description) {
      targets.push({
        id: entity.id,
        kind: "room",
        prompt: roomPrompt(entity.name, entity.description),
      });
    } else if (isPerson(entity) && entity.description) {
      targets.push({
        id: entity.id,
        kind: "character",
        prompt: characterPrompt(entity.name, entity.pronouns, entity.description),
      });
    }
  }
  return targets;
}

function refPath(kind: ImageKind): string {
  return resolve(IMAGES_DIR, "_ref", `${kind}.webp`);
}

async function reference(kind: ImageKind): Promise<Buffer[]> {
  const path = refPath(kind);
  if (!existsSync(path)) {
    return [];
  }
  return [await webpToPng(readFileSync(path))];
}

function write(path: string, data: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

async function generateRefs(): Promise<void> {
  const key = apiKey();
  for (const kind of Object.keys(REFERENCE_PROMPTS) as ImageKind[]) {
    process.stdout.write(`ref ${kind}... `);
    const { png, costUsd } = await generateImage({
      prompt: REFERENCE_PROMPTS[kind],
      apiKey: key,
      model: MODEL,
    });
    const dims = KIND_DIMS[kind];
    const webp = await pngToWebp(png, dims.width, dims.height, QUALITY);
    write(refPath(kind), webp);
    console.log(`saved ${kb(webp)} ($${costUsd.toFixed(4)})`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--refs")) {
    await generateRefs();
    return;
  }

  const force = args.includes("--force");
  const kindIndex = args.indexOf("--kind");
  const kind = kindIndex >= 0 ? (args[kindIndex + 1] as ImageKind) : undefined;
  const ids = args.filter(
    (arg, i) => !arg.startsWith("--") && (kindIndex < 0 || i !== kindIndex + 1),
  );

  const manifest = loadManifest(MANIFEST_FILE);
  manifest.style = STYLE;

  let targets = collectTargets();
  if (kind) {
    targets = targets.filter((target) => target.kind === kind);
  }
  if (ids.length) {
    targets = targets.filter((target) => ids.includes(target.id));
  }
  if (!targets.length) {
    console.log("no matching entities");
    return;
  }

  const key = apiKey();
  let spent = 0;
  const failed: string[] = [];
  for (const target of targets) {
    const hash = shortHash(`${MODEL}\n${target.prompt}`);
    const file = `${KIND_DIR[target.kind]}/${target.id}.webp`;
    const outPath = resolve(IMAGES_DIR, file);
    const existing = manifest.entries[target.id];
    if (!force && existing?.promptHash === hash && existsSync(outPath)) {
      console.log(`skip ${target.id} (up to date)`);
      continue;
    }

    process.stdout.write(`gen ${target.id} (${target.kind})... `);
    try {
      const { png, costUsd } = await generateImage({
        prompt: target.prompt,
        apiKey: key,
        model: MODEL,
        references: await reference(target.kind),
      });
      const dims = KIND_DIMS[target.kind];
      const webp = await pngToWebp(png, dims.width, dims.height, QUALITY);
      write(outPath, webp);
      manifest.entries[target.id] = {
        kind: target.kind,
        file,
        promptHash: hash,
        model: MODEL,
        generated: new Date().toISOString(),
      };
      // Save after each image so an interrupted run keeps its progress.
      saveManifest(MANIFEST_FILE, manifest);
      spent += costUsd;
      console.log(`saved ${kb(webp)} ($${costUsd.toFixed(4)})`);
    } catch (error) {
      // One flaky entity should not abort the batch; note it and move on.
      console.log(`FAILED: ${error instanceof Error ? error.message : error}`);
      failed.push(target.id);
    }
  }
  const note = failed.length ? `, failed: ${failed.join(", ")}` : "";
  console.log(`done ($${spent.toFixed(4)})${note}`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
