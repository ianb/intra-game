# Which models a player without an account can pick

A player who hasn't connected an OpenRouter account gets the free models, and
that list is fetched live rather than kept here — new ones appear without a
change.

It was matching nothing. The check compared `pricing.request` against the string
`"0"`, and OpenRouter omits the field rather than sending a zero, so every model
failed it and the dropdown came out empty. That is the path the spending-limit
message points people at when their server allowance runs out, so it has to work
for exactly the people least likely to have an account.

```ts setup
import { isFreeModel } from "../lib/llm.js";

const model = (pricing) => ({ id: "m", pricing });
```

## A missing price is not a price

```ts
const omitted = model({ prompt: "0", completion: "0" });
isFreeModel(omitted);
=> true
```

Nor is a zero written some other way — these come from an API as strings, and
`"0.00"` and `"0"` are the same amount of money.

``` continue
const written = model({ prompt: "0.00", completion: "0", request: "0" });
isFreeModel(written);
=> true
```

## Anything actually charged is not free

Including a model that charges only per request, which is the case the old check
was reaching for and the reason not to simply drop the field.

```ts
const perToken = model({ prompt: "0.0000006", completion: "0" });
const perRequest = model({ prompt: "0", completion: "0", request: "0.001" });
const perOutput = model({ prompt: "0", completion: "0.0000004" });
[isFreeModel(perToken), isFreeModel(perRequest), isFreeModel(perOutput)].join(" ");
=> false false false
```
