# Parsing LLM tag output

The LLM never emits real HTML or XML — it emits _tag-shaped_ output like
`<dialog character="Ama">...</dialog>` and `<set attr="player.name">...</set>`
that the engine parses into game actions. `parseTags` is the permissive parser
that turns that text into a tree of `TagType` nodes, and `unfoldTags` flattens a
tree so that action tags buried inside a container (like `<dialog>`) surface as
top-level siblings.

Because the parser is deliberately permissive — real LLM output is messy — its
edge-case behavior (mismatched tags, unclosed tags, stray backticks) is part of
the contract. These examples are that contract.

```ts setup
import { parseTags, unfoldTags } from "../lib/parsetags.js";
import { tmpl } from "../lib/template.js";
```

## A simple tag

The common case: one tag wrapping some content. Each node has a `type`, an
`attrs` map, and its `content`.

```ts
parseTags("<div>Hello</div>")
=> [
  {
    "type": "div",
    "attrs": {},
    "content": "Hello"
  }
]
```

## Nested tags

A tag's `content` keeps the raw inner text, while `subTags` holds the parsed
children. Text between child tags becomes a `comment` node.

```ts
const nested = parseTags("<div><span>Hello</span> world</div>");
nested.length
=> 1

nested[0].content
=> <span>Hello</span> world

nested[0].subTags.length
=> 2

nested[0].subTags[0]
=> {
  "type": "span",
  "attrs": {},
  "content": "Hello"
}

nested[0].subTags[1]
=> {
  "type": "comment",
  "attrs": {},
  "content": "world"
}
```

## Attributes

Attributes are parsed into the `attrs` map. Self-closing tags have empty
`content`.

```ts
parseTags(`<input type="text" value="Hello" />`)
=> [
  {
    "type": "input",
    "attrs": {
      "type": "text",
      "value": "Hello"
    },
    "content": ""
  }
]
```

A self-closing tag with no attributes still parses:

```ts
parseTags("<br/>")[0]
=> {
  "type": "br",
  "attrs": {},
  "content": ""
}
```

## Text nodes become comments

Loose text outside any tag is preserved as `comment` nodes, so surrounding prose
survives round-trips.

```ts
const mixed = parseTags("Before<div>Inside</div>After");
mixed.map((t) => t.type).join(", ")
=> comment, div, comment

mixed.map((t) => t.content).join(" | ")
=> Before | Inside | After
```

## Permissive recovery

Real model output isn't well-formed, so the parser recovers instead of throwing.

An allow-list downgrades disallowed tags to comments rather than dropping them:

```ts
const filtered = parseTags(`<div>Allowed content</div><script>alert('x');</script>`, ["div"]);
filtered.length
=> 2

filtered[1]
=> {
  "type": "comment",
  "attrs": {},
  "content": "alert('x');"
}
```

Mismatched closing tags auto-close the open tag:

```ts
const mismatched = parseTags(`<div><span>Test</div></span>`);
mismatched.length
=> 1

mismatched[0].type
=> div

mismatched[0].content.includes("Test")
=> true
```

Tags left open at the end of the string are auto-closed:

```ts
const unclosed = parseTags(`<div><span>Open`);
unclosed[0].type
=> div

unclosed[0].subTags.length
=> 1

unclosed[0].subTags[0].type
=> span
```

Wrapping backticks (the model loves a code fence) and surrounding whitespace are
trimmed away before parsing:

```ts
parseTags("```\n  <div>Trimmed</div>\n```")[0].content
=> Trimmed
```

## Unfolding action tags out of containers

The engine keeps some tags as planning containers (like `<context>`) but wants
action tags (`<dialog>`, `<set>`) as flat siblings it can process in order.
`unfoldTags` does that flattening: `ignoreContainers` are left folded, while
everything else is hoisted, and `trimEmpty` drops content-less tags.

Here a `<set>` is embedded mid-sentence inside a `<dialog>`; unfolding lifts it
out to a top-level sibling while the dialog keeps the surrounding prose:

```ts
const input = tmpl`
<context>
question answering
</context>

<dialog character="Ama">
para1

para2_start <set attr="player.profession">internet troll</set> para2_end
</dialog>
`;
const unfolded = unfoldTags(parseTags(input), {
  ignoreContainers: ["context"],
  trimEmpty: ["dialog", "description"],
});
unfolded.length
=> 3

unfolded[0]
=> {
  "type": "context",
  "attrs": {},
  "content": "question answering"
}

unfolded[1]
=> {
  "type": "dialog",
  "attrs": {
    "character": "Ama"
  },
  "content": "para1\n\npara2_start\npara2_end"
}

unfolded[2]
=> {
  "type": "set",
  "attrs": {
    "attr": "player.profession"
  },
  "content": "internet troll"
}
```
