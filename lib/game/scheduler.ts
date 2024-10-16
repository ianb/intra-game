import sortBy from "just-sort-by";
import type { Person, PersonScheduleType } from "../types";
import { PersonScheduleTemplateType, PersonScheduledEventType } from "../types";

// Utility function to return a random integer between low and high inclusive
function randrange(low: number, high: number): number {
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function shuffle<T>(array: T[]): T[] {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Main function to generate the exact schedule
export function generateExactSchedule(
  generalSchedule: PersonScheduleTemplateType[]
): PersonScheduledEventType[] {
  if (!generalSchedule.length) {
    return [];
  }
  // Pick randomly when two events have the exact same start time:
  const startTimes = new Map<number, PersonScheduleTemplateType>();
  for (const event of generalSchedule) {
    const startTime = event.time;
    if (startTimes.has(event.time)) {
      // Already an event at this time, randomly keep one
      if (Math.random() < 0.5) {
        startTimes.set(startTime, event);
      }
      // Else, discard current event
    } else {
      startTimes.set(startTime, event);
    }
  }

  const timedEvents = Array.from(startTimes.values()).map((event) => {
    const earliestStart = event.time - event.early;
    const latestStart = event.time + event.late;
    const newTime = randrange(earliestStart, latestStart);
    return {
      scheduleId: event.id,
      time: newTime,
      minuteLength: event.minuteLength,
      inside: shuffle(event.inside),
    } as PersonScheduledEventType;
  });

  const sortedEvents = sortBy(timedEvents, (x) => x.time);

  // Step 5: Adjust durations to prevent overlaps and fill gaps
  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    const nextEvent = sortedEvents[i + 1];

    if (nextEvent) {
      if (event.time + event.minuteLength > nextEvent.time) {
        // Overlap detected, shorten the current event
        event.minuteLength = nextEvent.time - event.time;
      } else if (event.time + event.minuteLength < nextEvent.time) {
        // Gap detected, extend the current event to fill the gap
        event.minuteLength = nextEvent.time - event.time;
      }
    } else {
      // Last event, ensure it doesn't go beyond 10:00 PM (1320 minutes)
      if (event.time + event.minuteLength > 1320) {
        event.minuteLength = 1320 - event.time;
      }
    }

    // Ensure event duration is non-negative
    if (event.minuteLength < 0) {
      event.minuteLength = 0;
    }
  }

  // Step 6: Ensure the schedule starts at 6:00 AM and ends at 10:00 PM
  const firstEvent = sortedEvents[0];
  if (firstEvent.time > 360) {
    firstEvent.minuteLength += firstEvent.time - 360;
    firstEvent.time = 360;
  } else if (firstEvent.time < 360) {
    firstEvent.minuteLength -= 360 - firstEvent.time;
    firstEvent.time = 360;
  }

  const lastEvent = sortedEvents[sortedEvents.length - 1];
  if (lastEvent.time + lastEvent.minuteLength < 1320) {
    lastEvent.minuteLength = 1320 - lastEvent.time;
    if (lastEvent.minuteLength < 0) {
      sortedEvents.pop();
    }
  }

  // Return the adjusted schedule
  return sortedEvents;
}

export function scheduleForTime(
  person: Person,
  time: number,
  schedule?: PersonScheduledEventType[]
): PersonScheduleType | undefined {
  // Just use the time of day:
  schedule = schedule || person.todaysSchedule;
  if (!schedule) {
    return undefined;
  }
  time = time % 1440;
  for (const event of schedule) {
    if (time < event.time + event.minuteLength) {
      const source = person.scheduleTemplate?.find(
        (template) => template.id === event.scheduleId
      );
      if (!source) {
        console.warn("No source for event", person.id, event);
        return undefined;
      }
      return {
        id: source.id,
        time: event.time,
        inside: event.inside,
        minuteLength: event.minuteLength,
        activity: source.activity,
        description: source.description,
        attentive: source.attentive,
        secret: source.secret,
        secretReason: source.secretReason,
      };
    }
  }
  return undefined;
}

export const ONE_DAY = 24 * 60;

export function timeAsString(timestampMinutes: number): string {
  const time = timestampMinutes % ONE_DAY;
  const minutes = (time % 60).toString().padStart(2, "0");
  let hours = Math.floor(time / 60) % 24;
  const period = hours < 12 ? "am" : "pm";
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  return `${hours}:${minutes}${period}`;
}
