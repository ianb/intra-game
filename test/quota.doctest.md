# What one player may spend

The AI Gateway has a total cap, which bounds the bill but not who consumes it.
One enthusiastic stranger can spend the month's allowance in an afternoon, and
everyone else — including the owner — gets a dead site until it resets. A total
cap converts an unbounded-money problem into a denial-of-service problem; this
is the other half.

```ts setup
import {
  currentWindow,
  newWindow,
  quotaConfig,
  spend,
  verdict,
  DEFAULT_LIMIT_USD,
} from "../worker/quota.js";

const day = 24 * 60 * 60_000;
const config = { limit: 1, periodMs: 30 * day };
const t0 = Date.parse("2026-07-01T00:00:00Z");
```

## Spending accumulates until it doesn't

At roughly $0.007 a turn, a dollar is about 140 turns.

```ts
let state = newWindow(t0);
for (let i = 0; i < 3; i++) state = spend(state, 0.007, config, t0);
const v = verdict(state, config, t0);
`${v.spent} spent, allowed=${v.allowed}`;
=> 0.021 spent, allowed=true
```

Once it's gone, the message says what to do about it rather than only refusing —
local play with their own key is still open to them:

``` continue
const broke = verdict(spend(state, 1, config, t0), config, t0);
broke.message;
=> You've used your $1.00 of server play. It resets on 2026-07-31. You can keep playing in this tab with your own model key.
```

## The window rolls, and it isn't the 1st of the month

A calendar month means every player's budget refills at midnight on the 1st and
the site falls over on the same day each month. The window is per player and
starts when they do.

```ts
const used = spend(newWindow(t0), 5, config, t0);
const at = (when) => verdict(currentWindow(used, config, when), config, t0).allowed;
const rolled = [at(t0 + 29 * day), at(t0 + 31 * day)].join(" ");
rolled;
=> false true
```

A stored window with a corrupt timestamp opens a new one rather than throwing,
or comparing against `NaN` and silently never rolling over:

``` continue
const corrupt = { spent: 99, since: "not a date" };
const reopened = currentWindow(corrupt, config, t0).spent;
reopened;
=> 0
```

## Configuration that doesn't mean what it says

`QUOTA_USD=abc` must not quietly mean unlimited. Anything unreadable falls back
to the default, because the failure that matters here is the one that opens the
gate.

```ts
const noSetting = {};
const nonsense = { QUOTA_USD: "abc" };
const negative = { QUOTA_USD: "-5" };
const real = { QUOTA_USD: "2.50" };
const envs = [noSetting, nonsense, negative, real];
const limits = envs.map((e) => quotaConfig(e).limit).join(" ");
limits;
=> 1 1 1 2.5
```

Zero is different from unset. "No server play for anyone" is a legitimate thing
to configure — it's what you set while investigating a bill — and it has to
survive the fallback that catches the nonsense above.

``` continue
const zero = { QUOTA_USD: "0" };
const closed = quotaConfig(zero);
const shut = [closed.limit, verdict(newWindow(t0), closed, t0).allowed].join(" ");
shut;
=> 0 false
```

## Costs that aren't numbers

A cost comes from a provider's usage report, which is occasionally absent or
nonsense. A `NaN` in the total would compare false against every limit and
disable the quota from then on, silently and permanently.

```ts
const junk = [NaN, undefined, null, -1, "0.5"];
const ignored = junk.reduce((acc, bad) => spend(acc, bad, config, t0), newWindow(t0));
ignored.spent;
=> 0
```

Rounding is applied on the way in, so thousands of small calls don't accumulate
float noise into the stored total:

``` continue
let acc = newWindow(t0);
for (let i = 0; i < 3; i++) acc = spend(acc, 0.1, config, t0);
acc.spent;
=> 0.3
```
