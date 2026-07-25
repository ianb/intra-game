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

export interface CassetteEntry { title: string; response: string }
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

// Replay a cassette. Unknown prompts fall through to onMiss (default: "", which
// parses to no game action) so incidental variance never crashes a replay.
export function replayChat(
  path: string,
  options: { onMiss?: (request: ChatType) => string } = {}
): ChatFn {
  const cassette = loadCassette(path);
  const onMiss = options.onMiss ?? (() => "");
  return async (request: ChatType) => {
    const entry = cassette[promptKey(request)];
    return entry ? entry.response : onMiss(request);
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
