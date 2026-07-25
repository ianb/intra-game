import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Frida's day. */
export const fridaSchedule: PersonScheduleTemplateType[] = [
  {
    id: "frida-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Frida starts her day by scribbling down her dreams, convinced they might contain valuable information about Intra.",
    inside: ["Quarters_Frida"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 30,
  },
  {
    id: "frida-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Frida eats while taking rapid notes on the exact composition of the food, noting changes in texture that might indicate a hidden message.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "frida-archive-dive",
    time: time("8:15 AM"),
    activity: "Archive Dive",
    description:
      "Frida rushes into the Archive Lounge, arms full of papers. She begins furiously documenting every minor inconsistency she finds, convinced there's a deeper meaning.",
    inside: ["Archive_Lounge"],
    attentive: true,
    early: 0,
    late: 15,
    minuteLength: 120,
  },
  {
    id: "frida-theory-break",
    time: time("10:15 AM"),
    activity: "Quick Theory Break",
    description:
      "Frida stops mid-documentation to develop a wild theory about the origins of Intra's malfunctioning sky screens, which she immediately starts scribbling down.",
    inside: ["Archive_Lounge"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 30,
  },
  {
    id: "frida-odd-files",
    time: time("11:00 AM"),
    activity: "Track Down Odd Files",
    description:
      "Frida dashes around the Archive Lounge, hunting for strange files she believes might hold the key to the mysterious 'Sentra.'",
    inside: ["Archive_Lounge"],
    attentive: true,
    early: 0,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "frida-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Scatterbrain Conversation",
    description:
      "Frida attempts to eat lunch but keeps interrupting herself to speculate about strange anomalies in the data she's found.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 20,
    minuteLength: 90,
  },
  {
    id: "frida-conspiracy-brainstorm",
    time: time("1:30 PM"),
    activity: "Conspiracy Brainstorm",
    description:
      "Frida sits in the corner of the Archive Lounge, piecing together unrelated data points into an elaborate conspiracy theory, occasionally forgetting where she was going with it.",
    inside: ["Archive_Lounge"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "frida-secret-data-stash",
    time: time("3:00 PM"),
    activity: "Secret Data Stash",
    description:
      "Frida sneaks into a hidden corner of the Archive Lounge to stash away a folder of documents she believes Ama doesn't want anyone to see. She hides them under a loose floor tile.",
    inside: ["Archive_Lounge"],
    attentive: false,
    early: 0,
    late: 5,
    minuteLength: 10,
    secret: true,
    secretReason:
      "Frida thinks she's onto something about 'Sentra' and is afraid Ama will find out.",
  },
  {
    id: "frida-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Wild Speculations",
    description:
      "Frida absentmindedly pokes at her dinner while continuing to ramble about bizarre theories, offering them to anyone nearby, whether they want to hear them or not.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "frida-late-night-data-sorting",
    time: time("8:00 PM"),
    activity: "Late-Night Data Sorting",
    description:
      "Frida stays up late, sorting through mountains of papers and old files, often muttering things like 'No, this can't be right… or can it?'",
    inside: ["Archive_Lounge"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 120,
  },
  {
    id: "frida-lights-out",
    time: time("9:30 PM"),
    activity: "Lights Out - Last-Minute Jotting",
    description:
      "Frida tries to sleep but keeps jumping up to jot down last-minute thoughts in her journal, convinced that something important will come to her just as she falls asleep.",
    inside: ["Quarters_Frida"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
];
