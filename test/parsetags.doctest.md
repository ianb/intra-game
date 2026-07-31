# Parsing LLM tag output

The LLM never emits real HTML or XML — it emits _tag-shaped_ output like
`<dialog character="Ama">...</dialog>` and `<set attr="PLAYER.name">...</set>`
that the engine parses into game actions. `parseTags` is the permissive parser
that turns that text into a tree of `TagType` nodes, and `unfoldTags` flattens a
tree so that action tags buried inside a container (like `<dialog>`) surface as
top-level siblings.

Because the parser is deliberately permissive — real LLM output is messy — its
edge-case behavior (mismatched tags, unclosed tags, stray backticks) is part of
the contract. These examples are that contract.

```ts setup
import { describeTag, parseTags, unfoldTags } from "../lib/parsetags.js";
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

para2_start <set attr="PLAYER.profession">internet troll</set> para2_end
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
    "attr": "PLAYER.profession"
  },
  "content": "internet troll"
}
```

## Naming a tag in a log line

An unrecognised tag is what the evals count as a protocol failure, and the
warning used to interpolate the tag object — so the only record of what a model
emitted read `Got unexpected tag: [object Object]`. That went unnoticed until
the number it produced was being used to choose a model, at which point the
evidence needed to judge the failure turned out to say nothing.

```ts
const [tag] = parseTags('<playerPronouns to="Ama">they/them</playerPronouns>');
describeTag(tag);
=> <playerPronouns to="Ama">they/them</playerPronouns>
```

Long content is cut, because this goes in a log line rather than a transcript:

``` continue
const [speech] = parseTags(`<dialog character="Ama">${"the ficus ".repeat(20)}</dialog>`);
describeTag(speech).length < 100;
=> true
```

## Sloppy markup that costs nothing

A model forgetting a closing tag was scored as a protocol failure — the same
category as inventing a tag or naming a room that doesn't exist. It isn't the
same thing: the parser closes it and the game is identical.

The test is whether the sloppy input produces the same tags as the tidy one, so
this compares them rather than asserting a shape.

```ts setup
const key = (s) =>
  JSON.stringify(parseTags(s).map((t) => [t.type, t.attrs, t.content.trim()]));
const same = (a, b) => key(a) === key(b);
```

```ts
const pairs = [
  [`<dialog character="Ama">Hi.</dialog><suggestion>go north`,
   `<dialog character="Ama">Hi.</dialog><suggestion>go north</suggestion>`],
  [`<dialog character="Ama">Hi.`, `<dialog character="Ama">Hi.</dialog>`],
  [`<dialog character="Ama">Hi.</wrong>`, `<dialog character="Ama">Hi.</dialog>`],
  [`<dialog character="Ama">Hi.</dialog></wrong>`, `<dialog character="Ama">Hi.</dialog>`],
];
const results = pairs.map(([sloppy, tidy]) => same(sloppy, tidy)).join(" ");
results;
=> true true true true
```

Those four are why `classifyWarnings` calls them lossless and scores nothing
against them.

## Sloppy markup that does cost something

Not every recovery is free, and the difference is worth keeping. An unclosed tag
*nested inside another* duplicates its own opening markup into the parent's
content:

```ts
const nested = parseTags(`<description>A room.<set attr="x">1</set>`);
nested[0].content.split("<set").length - 1;
=> 2
```

The tidy version has one, so this is a real defect rather than untidiness, and it
stays scored as a failure.

``` continue
const tidy = parseTags(`<description>A room.<set attr="x">1</set></description>`);
tidy[0].content.split("<set").length - 1;
=> 1
```

## Emphasis is text, not protocol

A model told to mention `/nav` in dialogue writes `<b>/nav Marta</b>`, because
that is what emphasising a command looks like. The parser saw an unknown tag,
warned, and threw away the words inside — so emphasis cost a turn and scored as
a protocol failure, which is a strange thing to fail a model for. Caught by the
intake eval dropping to 6/7 the moment Ama was told to mention the command.

```ts
parseTags(`<dialog character="Ama">Just type <b>/nav Marta</b> and I'll help.</dialog>`)[0].content;
=> Just type /nav Marta and I'll help.
```

Only emphasis. Anything that might carry meaning is still a tag, and an unknown
one is still worth complaining about:

``` continue
parseTags("<div><span>Hello</span> world</div>")[0].content;
=> <span>Hello</span> world
```
