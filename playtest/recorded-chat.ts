import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ChatType } from "../lib/types";
import type { ChatFn } from "../lib/game/model";

// Record/replay ("cassette") LLM backends. A cassette is a JSON map from a hash
// of the prompt to the model's response. Record once against a real Haiku-level
// model (see record.ts) and commit the cassette; tests then replay it — the same
// real model behavior, but deterministic, fast, and offline.
//
// Prompts embed game time and room contents, so replay is only stable if the run
// is deterministic. The playtest drivers seed Math.random (see seed.ts) so the
// schedule — and therefore every prompt — reproduces exactly.

export interface CassetteEntry {
  title: string;
  response: string;
}
export type Cassette = Record<string, CassetteEntry>;

export function promptKey(request: ChatType): string {
  const payload = JSON.stringify(request.messages);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function loadCassette(path: string): Cassette {
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf-8")) as Cassette)
    : {};
}

/**
 * What a miss almost always means, said out loud.
 *
 * A stale cassette is silent by construction: the key is a hash of the prompt,
 * so changing a prompt misses every entry, and a miss returns "" — which parses
 * to no game action. The test then fails on game *state* ("the player has no
 * name", "Ama never finished intake"), which reads as the engine being broken
 * rather than the fixture being old. That cost a confusing few minutes here
 * twice in one afternoon, and would cost more to someone who hadn't just edited
 * the prompt themselves.
 */
export function cassetteMissMessage(
  path: string,
  request: ChatType,
  recorded: number,
  hits: number,
): string {
  const name = path.replace(/^.*\/|\.json$/g, "");
  if (recorded === 0) {
    return `No cassette at ${path} — record it with: pnpm playtest:record ${name}`;
  }
  return (
    `Cassette miss in ${path}: no recorded reply for "${request.meta.title}" ` +
    `(${recorded} entries recorded, ${hits} matched so far).\n` +
    (hits === 0
      ? `  Nothing has matched, so the cassette is stale — the prompts changed since it was recorded.\n`
      : `  Prompts have changed since this was recorded.\n`) +
    `  Re-record: rm ${path} && pnpm playtest:record ${name}`
  );
}

// Replay a cassette. Unknown prompts fall through to onMiss (default: "", which
// parses to no game action) so incidental variance never crashes a replay.
//
// Misses are reported once per replay, on console.error rather than
// console.warn: the eval harness captures console.warn as the model's protocol
// failures (see evals/harness.ts), and a stale fixture is not the model getting
// anything wrong.
export function replayChat(
  path: string,
  options: { onMiss?: (request: ChatType) => string } = {},
): ChatFn {
  const cassette = loadCassette(path);
  const recorded = Object.keys(cassette).length;
  // An explicit onMiss means the caller is handling misses deliberately, so
  // they aren't news.
  const announce = !options.onMiss;
  const onMiss = options.onMiss ?? (() => "");
  let hits = 0;
  let announced = false;
  return async (request: ChatType) => {
    const entry = cassette[promptKey(request)];
    if (entry) {
      hits++;
      return entry.response;
    }
    if (announce && !announced) {
      announced = true;
      console.error(cassetteMissMessage(path, request, recorded, hits));
    }
    return onMiss(request);
  };
}

// Wrap a real backend so every call is cached to the cassette on disk. Cache
// hits are reused (so re-recording only fills gaps); misses call `generate`.
export function recordingChat(path: string, generate: ChatFn): ChatFn {
  const cassette = loadCassette(path);
  return async (request: ChatType) => {
    const key = promptKey(request);
    const existing = cassette[key];
    if (existing) {
      return existing.response;
    }
    const response = await generate(request);
    cassette[key] = { title: request.meta.title, response };
    writeFileSync(path, JSON.stringify(cassette, null, 2) + "\n");
    return response;
  };
}
