import { parseAttrs } from "../parsetags";

/**
 * Incremental parsing of an LLM response, for streaming play.
 *
 * The tag protocol is naturally streamable — tags close one at a time — but not
 * every tag can be shown as it arrives. Narrative tags (`<dialog>`,
 * `<description>`) are exactly what a player wants to watch appear. State
 * mutations are not: half of `<set attr="PLAYER.name">Ada Quill</set>` would set
 * the name to "Ad". So mutating tags surface only once complete.
 *
 * Two things this deliberately does NOT do:
 *
 * 1. It does not replace the authoritative parse. When the response finishes,
 *    the engine still runs the whole text through `parseTags`/`unfoldTags` and
 *    applies the result, exactly as before — that path is battle-tested and the
 *    recorded playthroughs are keyed to it. This layer is additive, for display.
 * 2. It does not interpret nesting. A streaming tag's content is emitted as raw
 *    text, so a `<set>` embedded mid-dialog streams as literal characters here
 *    and is hoisted out properly by the authoritative parse afterwards.
 */

/** Tags whose content is streamed as it arrives; everything else is complete-only. */
export const STREAMING_TAG_TYPES: ReadonlySet<string> = new Set([
  "dialog",
  "description",
]);

/**
 * A tag still being received. `content` is what has arrived so far, so it must
 * never be used to change game state — only to display.
 */
export interface PartialTag {
  state: "partial";
  type: string;
  attrs: Record<string, string>;
  content: string;
}

/** A tag that has closed. `content` is final and safe to act on. */
export interface CompleteTag {
  state: "complete";
  type: string;
  attrs: Record<string, string>;
  content: string;
}

export type StreamedTag = PartialTag | CompleteTag;

/** Narrow a tag of either state; the compiler stops partials reaching state changes. */
export function isComplete(tag: StreamedTag): tag is CompleteTag {
  return tag.state === "complete";
}

/**
 * What the parser emits.
 *
 * `open` and `delta` only ever fire for streaming tag types. Every tag,
 * streaming or not, ends with exactly one `close`.
 */
export type TagStreamEvent =
  | { kind: "open"; tag: PartialTag }
  | { kind: "delta"; tag: PartialTag; delta: string }
  | { kind: "close"; tag: CompleteTag };

interface OpenTagState {
  type: string;
  attrs: Record<string, string>;
  content: string;
  depth: number;
  streaming: boolean;
}

// Deliberately the same shape as the pattern in parsetags.ts, so the streaming
// parser and the authoritative parser agree on where tags begin and end.
const OPEN_TAG = /<([a-zA-Z][^\s>/]*)([^>]*?)(\/?)>/;

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Feed response chunks in, get display events out.
 *
 * Chunk boundaries are arbitrary — a tag delimiter can be split across them —
 * so content is only released once it cannot turn out to be the start of a
 * closing tag.
 */
export class TagStreamParser {
  private buffer = "";
  private open: OpenTagState | null = null;

  feed(chunk: string): TagStreamEvent[] {
    this.buffer += chunk;
    const events: TagStreamEvent[] = [];
    for (;;) {
      const progressed = this.open
        ? this.consumeInsideTag(events)
        : this.consumeLookingForTag(events);
      if (!progressed) {
        return events;
      }
    }
  }

  /** Flush at end of response, auto-closing anything left open. */
  end(): TagStreamEvent[] {
    const events: TagStreamEvent[] = [];
    if (this.open) {
      const remainder = this.buffer;
      if (remainder && this.open.streaming) {
        this.open.content += remainder;
        events.push({ kind: "delta", tag: this.snapshot(), delta: remainder });
      } else {
        this.open.content += remainder;
      }
      events.push({ kind: "close", tag: this.complete() });
      this.open = null;
    }
    this.buffer = "";
    return events;
  }

  private snapshot(): PartialTag {
    const open = this.open!;
    return {
      state: "partial",
      type: open.type,
      attrs: open.attrs,
      content: open.content,
    };
  }

  private complete(): CompleteTag {
    const open = this.open!;
    return {
      state: "complete",
      type: open.type,
      attrs: open.attrs,
      content: open.content,
    };
  }

  /** Outside any tag: look for the next opening tag, discarding loose text. */
  private consumeLookingForTag(events: TagStreamEvent[]): boolean {
    const match = OPEN_TAG.exec(this.buffer);
    if (!match) {
      // Keep only a trailing "<..." that might grow into a tag.
      const lt = this.buffer.lastIndexOf("<");
      this.buffer = lt === -1 ? "" : this.buffer.slice(lt);
      return false;
    }
    const [full, name, attrText, selfClosing] = match;
    this.buffer = this.buffer.slice(match.index + full.length);
    const attrs = parseAttrs(attrText ?? "");
    if (selfClosing) {
      events.push({
        kind: "close",
        tag: { state: "complete", type: name!, attrs, content: "" },
      });
      return true;
    }
    this.open = {
      type: name!,
      attrs,
      content: "",
      depth: 1,
      streaming: STREAMING_TAG_TYPES.has(name!),
    };
    if (this.open.streaming) {
      events.push({ kind: "open", tag: this.snapshot() });
    }
    return true;
  }

  /** Inside a tag: release content, tracking nesting, until the matching close. */
  private consumeInsideTag(events: TagStreamEvent[]): boolean {
    const open = this.open!;
    const name = escapeForRegex(open.type);
    // Built from the tag name we already parsed, run through escapeForRegex.
    // eslint-disable-next-line security/detect-non-literal-regexp
    const boundary = new RegExp(`</${name}\\s*>|<${name}(?:\\s[^>]*)?>`);
    const match = boundary.exec(this.buffer);

    if (!match) {
      // No boundary yet. Hold back a trailing "<..." which may be a partial
      // closing tag; everything before it is safe to release.
      const lt = this.buffer.lastIndexOf("<");
      const safeEnd = lt === -1 ? this.buffer.length : lt;
      this.release(events, this.buffer.slice(0, safeEnd));
      this.buffer = this.buffer.slice(safeEnd);
      return false;
    }

    const isClosing = match[0].startsWith("</");
    if (!isClosing) {
      // A nested tag of the same name — content, not our close.
      open.depth++;
      this.release(events, this.buffer.slice(0, match.index + match[0].length));
      this.buffer = this.buffer.slice(match.index + match[0].length);
      return true;
    }

    open.depth--;
    if (open.depth > 0) {
      this.release(events, this.buffer.slice(0, match.index + match[0].length));
      this.buffer = this.buffer.slice(match.index + match[0].length);
      return true;
    }

    this.release(events, this.buffer.slice(0, match.index));
    this.buffer = this.buffer.slice(match.index + match[0].length);
    events.push({ kind: "close", tag: this.complete() });
    this.open = null;
    return true;
  }

  /** Accumulate content, emitting a delta only for streaming tags. */
  private release(events: TagStreamEvent[], text: string): void {
    if (!text) {
      return;
    }
    const open = this.open!;
    open.content += text;
    if (open.streaming) {
      events.push({ kind: "delta", tag: this.snapshot(), delta: text });
    }
  }
}
