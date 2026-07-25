# Streaming a response as it arrives

The tag protocol is naturally streamable — tags close one at a time — but not
everything can be shown while it's still arriving. Narrative tags are exactly
what a player wants to watch appear; state mutations are not, because half of
`<set attr="PLAYER.name">Ada Quill</set>` would set the name to "Ad".

So `TagStreamParser` streams narrative tags and holds mutating ones until they
complete, and the two states are distinct types so a partial can't be mistaken
for something safe to act on.

```ts setup
import { TagStreamParser, isComplete, STREAMING_TAG_TYPES } from "../lib/game/tagstream.js";
import { parseTags } from "../lib/parsetags.js";

// Feed a response in the given chunks and describe what came out.
function stream(chunks: string[]): string[] {
  const parser = new TagStreamParser();
  const out: string[] = [];
  const record = (e: ReturnType<TagStreamParser["feed"]>[number]) => {
    if (e.kind === "open") out.push(`open ${e.tag.type}`);
    else if (e.kind === "delta") out.push(`delta ${JSON.stringify(e.delta)}`);
    else out.push(`close ${e.tag.type} ${JSON.stringify(e.tag.content)}`);
  };
  for (const chunk of chunks) parser.feed(chunk).forEach(record);
  parser.end().forEach(record);
  return out;
}
```

## Narrative tags stream

A `<dialog>` announces itself, emits its text as it arrives, then closes with the
final content:

```ts
stream([`<dialog character="Ama">Hello there.</dialog>`]);
=> [
  "open dialog",
  "delta \"Hello there.\"",
  "close dialog \"Hello there.\""
]
```

## Mutating tags only appear complete

A `<set>` produces exactly one event — its close. There is no point at which a
consumer could see a half-written value:

```ts
stream([`<set attr="PLAYER.name">Ada Quill</set>`]);
=> [
  "close set \"Ada Quill\""
]
```

Which tags stream is explicit:

```ts
[STREAMING_TAG_TYPES.has("dialog"), STREAMING_TAG_TYPES.has("set")].join(" ");
=> true false
```

## Chunk boundaries don't matter

Chunks arrive wherever the network splits them — mid tag name, mid attribute,
mid closing tag. Content is only released once it can't turn out to be the start
of a closing tag, so the text still arrives in order and the final content is
identical:

```ts
stream([`<dial`, `og character="A`, `ma">Hel`, `lo the`, `re.</dia`, `log>`]);
=> [
  "open dialog",
  "delta \"Hel\"",
  "delta \"lo the\"",
  "delta \"re.\"",
  "close dialog \"Hello there.\""
]
```

## A realistic mixed response

The model plans in `<context>`, speaks, then writes state. Only the speech
streams:

```ts
stream([
  `<context>weighing it up</context>`,
  `<dialog character="Ama">Welcome home.</dialog>`,
  `<set attr="Ama.sharedSelf">true</set>`,
]);
=> [
  "close context \"weighing it up\"",
  "open dialog",
  "delta \"Welcome home.\"",
  "close dialog \"Welcome home.\"",
  "close set \"true\""
]
```

## Truncated responses still close

If the model stops mid-tag, `end()` closes what's open so a turn is never left
hanging:

```ts
stream([`<dialog character="Ama">cut off`]);
=> [
  "open dialog",
  "delta \"cut off\"",
  "close dialog \"cut off\""
]
```

## Streamed content matches the authoritative parse

This is the safety property. Streaming is only for display — the engine still
applies the completed response through `parseTags`, so the two must agree on
what a tag contained:

```ts
const response = `<dialog character="Ama">Welcome home.</dialog><set attr="Ama.sharedSelf">true</set>`;
const parser = new TagStreamParser();
const closed: Record<string, string> = {};
for (const chunk of response.match(/[\s\S]{1,7}/g)!) {
  for (const e of parser.feed(chunk)) if (isComplete(e.tag)) closed[e.tag.type] = e.tag.content;
}
for (const e of parser.end()) if (isComplete(e.tag)) closed[e.tag.type] = e.tag.content;

const authoritative = Object.fromEntries(parseTags(response).map((t) => [t.type, t.content]));
JSON.stringify(closed) === JSON.stringify(authoritative);
=> true
```
