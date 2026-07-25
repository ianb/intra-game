/** Minutes-since-midnight from the "6:00 AM" literals the schedules are written in. */
export function time(timeString: string): number {
  // Fixed-width, fully anchored pattern applied to schedule literals defined
  // in this repo - not user input, so backtracking is not a concern.
  // eslint-disable-next-line security/detect-unsafe-regex
  const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/;
  const match = timeString.trim().match(timeRegex);
  if (!match) {
    throw new Error("Invalid time format");
  }
  let hours = parseInt(match[1]!, 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]!.toLowerCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    throw new Error("Invalid time range");
  }
  if (period === "pm" && hours !== 12) {
    hours += 12;
  } else if (period === "am" && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}
