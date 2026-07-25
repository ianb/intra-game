# Character schedules

Every character follows a daily schedule. `timeAsString` formats the game clock
(minutes since midnight), and `generateExactSchedule` turns a character's rough
template into a concrete, gap-free day — jittering start times within each
entry's early/late window but always keeping the day well-formed.

```ts setup
import { timeAsString, generateExactSchedule } from "../lib/game/scheduler.js";
import type { PersonScheduleTemplateType } from "../lib/types.js";
```

## Formatting the clock

Minutes since midnight render as a 12-hour time:

```ts
[timeAsString(360), timeAsString(720), timeAsString(1320), timeAsString(1439)].join(" ");
=> 6:00am 12:00pm 10:00pm 11:59pm
```

## Building a concrete day

Because start times are jittered, the schedule's exact minutes vary run to run —
so the contract is a set of invariants, not fixed values. Given a template:

```ts
const template: PersonScheduleTemplateType[] = [
  { id: "wake", time: 360, activity: "wake", description: "waking up", minuteLength: 60, inside: ["Quarters_Yours"], attentive: true, early: 0, late: 0 },
  { id: "work", time: 600, activity: "work", description: "working", minuteLength: 120, inside: ["Activity_Hub"], attentive: true, early: 10, late: 10 },
  { id: "sleep", time: 1200, activity: "sleep", description: "sleeping", minuteLength: 120, inside: ["Quarters_Yours"], attentive: false, early: 0, late: 0 },
];
const schedule = generateExactSchedule(template);
```

The day always starts at 6:00am (360) and is ordered by time:

``` continue
schedule[0]!.time;
=> 360

schedule.every((e, i) => i === 0 || schedule[i - 1]!.time <= e.time);
=> true
```

It never runs past 10:00pm (1320), and no activity has a negative duration
(overlaps are trimmed, gaps are filled):

``` continue
const last = schedule[schedule.length - 1]!;
last.time + last.minuteLength <= 1320;
=> true

schedule.every((e) => e.minuteLength >= 0);
=> true
```

An empty template produces an empty schedule:

```ts
generateExactSchedule([]);
=> []
```
