/**
 * Reading Server-Sent Events.
 *
 * Both directions of the game's streaming use SSE — the LLM upstream, and the
 * server streaming a turn to the browser — and both need the same care: chunks
 * arrive on arbitrary boundaries, so an event can be split across them. Getting
 * that buffering right once is better than twice.
 */

export interface SseEvent {
  /** The `event:` name, or "message" when the stream doesn't name one. */
  event: string;
  /** The joined `data:` lines. */
  data: string;
}

/**
 * Yield each complete event from an SSE body.
 *
 * Events are separated by a blank line; anything still buffered when the stream
 * ends is yielded if it contains data, so a truncated final event isn't silently
 * dropped.
 */
export async function* readSse(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const parsed = parseSseEvent(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
      if (parsed) {
        yield parsed;
      }
      sep = buffer.indexOf("\n\n");
    }
  }
  const tail = parseSseEvent(buffer);
  if (tail) {
    yield tail;
  }
}

/** Parse one event block, or null if it carries no data. */
export function parseSseEvent(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) {
      // A comment/keepalive.
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (!data.length) {
    return null;
  }
  return { event, data: data.join("\n") };
}
