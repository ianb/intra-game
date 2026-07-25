# Intra's shared day

Every character has their own schedule, but those were written against one
shared rhythm — every day has a "Wake-up Chime" and a "Lunch & Reflection"
because Intra's does. `intraActivityForTime` is the lookup into that rhythm, so
a character's prompt can say what the whole complex is doing, not just what they
personally are up to.

```ts setup
import { intraActivityForTime } from "../lib/game/scheduler.js";
import { intraSchedule } from "../lib/game/content/schedules/day.js";

const at = (hours: number, minutes = 0) =>
  intraActivityForTime(hours * 60 + minutes)?.activity ?? "(none)";
```

The day, hour by hour:

```ts
[at(6), at(7, 30), at(10), at(12, 30), at(15), at(19), at(21, 30)].join(" / ");
=> Wake-up Chime / Breakfast / Work Begins / Lunch & Reflection / Afternoon Work / Dinner & Relaxation / Quiet Time
```

Boundaries belong to the activity starting, not the one ending — breakfast runs
7:00 to 9:00, so 9:00 sharp is already work:

```ts
[at(6, 59), at(7), at(8, 59), at(9)].join(" / ");
=> Wake-up Chime / Breakfast / Breakfast / Work Begins
```

Lights-out starts at 10pm and runs eight hours, so it wraps past midnight and
covers the small hours — the answer at 2am is not "the first thing in the list":

```ts
[at(22), at(23, 59), at(0), at(2), at(5, 59)].join(" / ");
=> Lights Out / Lights Out / Lights Out / Lights Out / Lights Out
```

Timestamps are absolute minutes since the game began, so they run well past one
day. The lookup takes the time of day:

```ts
[at(24 + 7), at(24 * 3 + 12, 30)].join(" / ");
=> Breakfast / Lunch & Reflection
```

A schedule that leaves a gap returns nothing, and the caller omits the section
rather than inventing one:

```ts
const sparse = [intraSchedule[0]!];
[
  intraActivityForTime(6 * 60, sparse)?.activity,
  intraActivityForTime(15 * 60, sparse),
].join(" / ");
=> Wake-up Chime / «undefined»
```
