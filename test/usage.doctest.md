# What each model call cost

Cost isn't one number, it's a shape. It varies by which prompt ran, which model
answered, how much history the prompt carried, and how far into the game it
happened. A total can tell you the game is expensive; only the breakdown can
tell you it's expensive because the character prompt grows with the history and
is never cached.

```ts setup
import {
  byPromptType,
  historyTurnsOf,
  parseUsage,
  toCsv,
  totals,
  usageRecord,
} from "../lib/usage.js";
import type { UsageRecordType } from "../lib/usage.js";

const request = (title: string, extra = {}) => ({
  meta: { title, turn: 12, entity: "Ama", ...extra },
  model: "flash" as const,
  messages: [
    { role: "system" as const, content: "you are Ama" },
    { role: "user" as const, content: "hello" },
    { role: "assistant" as const, content: "hi" },
  ],
});

const record = (over: Partial<UsageRecordType> = {}): UsageRecordType => ({
  at: "2026-07-26T00:00:00.000Z",
  ms: 100,
  promptType: "prompt Ama",
  model: "anthropic/claude-haiku-4-5",
  turn: 1,
  historyTurns: 2,
  promptTokens: 1000,
  completionTokens: 100,
  cachedTokens: 0,
  cost: 0.001,
  ...over,
});
```

## Reading what a provider said

The shape is OpenAI-compatible, but the two interesting fields are extensions:
the cache hit and the money.

```ts
const usage = parseUsage({
  prompt_tokens: 2400,
  completion_tokens: 180,
  prompt_tokens_details: { cached_tokens: 1400 },
  cost: 0.0042,
});
[usage.promptTokens, usage.cachedTokens, usage.completionTokens, usage.cost].join(" ");
=> 2400 1400 180 0.0042
```

Anthropic's own naming for the cache hit is read too, since AI Gateway passes
some providers through more literally than others:

```ts
parseUsage({ prompt_tokens: 10, cache_read_input_tokens: 7 }).cachedTokens;
=> 7
```

A provider that reports neither gives zeros rather than an exception. Billing
detail is not worth failing a turn over:

```ts
const usage = parseUsage(undefined);
[usage.promptTokens, usage.cachedTokens, usage.cost].map(String).join(" ");
=> 0 0 undefined
```

## The context that makes a record answerable

A record carries where in the game it happened and how much history it was
carrying, which is what turns "expensive" into "expensive *because*":

```ts
const made = usageRecord({
  request: request("prompt Ama"),
  model: "anthropic/claude-haiku-4-5",
  raw: { prompt_tokens: 2400, completion_tokens: 180 },
  ms: 900,
});
[made.promptType, made.entity, made.turn, made.historyTurns, made.tier].join(" | ");
=> prompt Ama | Ama | 12 | 2 | flash
```

History turns are counted from the request when nothing stamped them, so a
record is never silently wrong about how much context it was carrying:

```ts
historyTurnsOf(request("x").messages);
=> 2
```

A failed call still produces a record. A turn that cost money and returned
nothing is exactly the kind you want to find later:

```ts
const failed = usageRecord({
  request: request("player input"),
  model: "m",
  ms: 30,
  error: "429 rate limited",
});
[failed.error, failed.promptTokens, failed.cost].map(String).join(" | ");
=> 429 rate limited | 0 | undefined
```

## Totals, and where the money goes

```ts
const sum = totals([
  record({ promptTokens: 1000, cost: 0.001 }),
  record({ promptTokens: 2000, cachedTokens: 500, cost: 0.002 }),
  record({ error: "boom", promptTokens: 0, cost: undefined }),
]);
[sum.calls, sum.promptTokens, sum.cachedTokens, sum.cost.toFixed(3), sum.errors].join(" ");
=> 3 3000 500 0.003 1
```

Per prompt type is the breakdown that actually decides anything — which prompt
to shrink, which to route to a smaller model:

```ts
const grouped = byPromptType([
  record({ promptType: "prompt Ama", promptTokens: 2500 }),
  record({ promptType: "prompt Ama", promptTokens: 2600 }),
  record({ promptType: "player input", promptTokens: 800 }),
]);
[grouped["prompt Ama"]!.promptTokens, grouped["player input"]!.calls].join(" / ");
=> 5100 / 1
```

## Out as CSV

"How does this grow over a game" is a spreadsheet question, and nobody should
have to write a parser to ask it:

```ts
toCsv([record({ promptType: "prompt Ama", turn: 4 })]).split("\n")[0];
=> at,turn,promptType,entity,model,tier,historyTurns,promptTokens,cachedTokens,completionTokens,cost,ms,user,error
```

``` continue
toCsv([record({ turn: 4, entity: "Ama" })]).split("\n")[1];
=> 2026-07-26T00:00:00.000Z,4,prompt Ama,Ama,anthropic/claude-haiku-4-5,,2,1000,0,100,0.001,100,,
```

Anything with a comma in it is quoted, so an error message can't shift every
column after it:

```ts
toCsv([record({ error: 'rate limited, retry after 30s' })]).includes('"rate limited, retry after 30s"');
=> true
```
