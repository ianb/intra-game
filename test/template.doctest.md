# The prompt template language

Prompts are assembled with the `tmpl` tagged template, which does more than
interpolate: it dedents, drops conditional sections whose values are empty, and
expands lists. Getting these rules right matters because every prompt the engine
sends the LLM is built this way.

```ts setup
import { tmpl, dedent, repr, isEmpty } from "../lib/template.js";
```

## Interpolation and dedenting

Values interpolate normally, and the common leading indentation is stripped so
prompts can be written as readable indented blocks:

```ts
tmpl`Hello ${"world"}!`;
=> Hello world!
```

```ts
tmpl`
  Line one
    indented two
  back one
`;
=> Line one
  indented two
back one
```

## Conditional sections

Text wrapped in `[[ … ]]` is kept only if the values inside it are non-empty —
the mechanism behind the many `[[…]]` guards in the prompts. A present value
keeps the section:

```ts
tmpl`Start[[ has ${"value"}]] End`;
=> Start has value End
```

An empty value removes the whole section:

```ts
tmpl`Start[[ has ${""}]] End`;
=> Start End
```

## List expansion

A `...` before a list value expands it into a bulleted list, matching the
surrounding bullet style:

```ts
tmpl`
Items:
- ...${["a", "b", "c"]}
`;
=> Items:
- a
- b
- c
```

## Helpers

`repr` renders values the way they appear in prompts — arrays comma-joined,
objects as JSON:

```ts
repr(["x", "y"]);
=> x, y

repr({ a: 1 });
=> {"a":1}
```

`isEmpty` is the emptiness test the conditionals use: empty string, empty array,
null, and undefined are all empty.

```ts
[isEmpty(""), isEmpty([]), isEmpty(null), isEmpty(undefined)].join(" ");
=> true true true true

Boolean(isEmpty("x"));
=> false
```
