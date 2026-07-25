# Sanitizing LLM output

Everything the model emits arrives as strings in tag attributes and content, and
the model is not reliable about them. These helpers are the boundary that keeps
that mess out of the game state: they always produce a usable value and warn
rather than throw, so one malformed tag can never break a turn.

```ts setup
import {
  coerceBoolean,
  coerceNumber,
  fixupText,
  isValidPropertySet,
} from "../lib/game/coerce.js";
```

## Booleans

Models write booleans many ways, so all the common spellings are accepted:

```ts
["true", "yes", "y", "on", "1"].map((v) => coerceBoolean(v)).join(" ");
=> true true true true true

["false", "no", "n", "off", "0"].map((v) => coerceBoolean(v)).join(" ");
=> false false false false false
```

A missing or nonsense attribute falls back to the caller's default rather than
throwing — which is why `<action success="???">` still resolves a turn:

```ts
[coerceBoolean(undefined), coerceBoolean("???")].join(" ");
=> false false

[coerceBoolean(undefined, true), coerceBoolean("???", true)].join(" ");
=> true true
```

## Numbers

Used for `minutes="…"` on actions and descriptions. Unparseable or missing
values become 0, so a bad duration costs no game time instead of producing `NaN`
and corrupting the clock:

```ts
[coerceNumber("5"), coerceNumber("2.5"), coerceNumber(undefined), coerceNumber("soon")].join(" ");
=> 5 2.5 0 0
```

## Response text

Models like typographic ellipses and stray HTML entities; both are normalized,
and surrounding whitespace is trimmed:

```ts
fixupText("  Well… maybe&#x20;not.  ");
=> Well... maybe not.
```

## Guarding `<set>`

The model is asked to set player properties only once it actually knows them,
but it will happily answer "unknown" instead of staying silent. Those non-answers
are rejected so they never land in the game state:

```ts
[
  isValidPropertySet("name", "Ada Quill"),
  isValidPropertySet("name", "unknown"),
  isValidPropertySet("name", "PLAYER"),
  isValidPropertySet("name", "You"),
].join(" ");
=> true false false false

[isValidPropertySet("profession", "data analyst"), isValidPropertySet("profession", "unspecified")].join(" ");
=> true false
```

Pronouns are restricted to the three supported sets, because anything else would
break the pronoun lookup used throughout the prompts:

```ts
[
  isValidPropertySet("pronouns", "she/her"),
  isValidPropertySet("pronouns", "they/them"),
  isValidPropertySet("pronouns", "ze/zir"),
  isValidPropertySet("pronouns", "unknown"),
].join(" ");
=> true true false false
```

Any other property passes through untouched, as do non-string values:

```ts
[isValidPropertySet("shortDescription", "a tired clerk"), isValidPropertySet("visits", 3)].join(" ");
=> true true
```
