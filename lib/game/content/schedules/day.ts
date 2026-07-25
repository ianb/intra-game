import type { GeneralScheduleType } from "../../../types";
import { time } from "./time";

/**
 * Intra's daily rhythm as Ama announces it, shared by everyone.
 */
export const intraSchedule: GeneralScheduleType[] = [
  {
    id: "intra-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Ama's soothing voice gently wakes the citizens: 'Good morning, citizens! Let's start the day strong.' Citizens freshen up and prepare for the day ahead.",
    minuteLength: 60,
  },
  {
    id: "intra-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast",
    description:
      "Breakfast in the Joyous Café with Ama's passive-aggressive encouragement: 'A nutritious start makes a happy citizen!' Light socializing, with Marta making sure everyone notices her 'Star Citizen' status.",
    minuteLength: 120,
  },
  {
    id: "intra-morning-work",
    time: time("9:00 AM"),
    activity: "Work Begins",
    description:
      "Citizens report to their departments for the day's tasks. Frida documents every detail, Harold enforces his invented rules, and Doug roams around interrupting people.",
    minuteLength: 180,
  },
  {
    id: "intra-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Reflection",
    description:
      "Lunch in the Joyous Café, followed by a Reflection Break in the Solitude Cubes or Ill-Fitting Lounge. June struggles to maintain calm, while Milton complains about small inconveniences.",
    minuteLength: 120,
  },
  {
    id: "intra-afternoon-work",
    time: time("2:00 PM"),
    activity: "Afternoon Work",
    description:
      "Citizens return to their departments for more work or absurd education. Lana makes odd adjustments in the Joyous Café to improve 'group cohesion.'",
    minuteLength: 240,
  },
  {
    id: "intra-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Relaxation",
    description:
      "Dinner in the Joyous Café, with time for socializing or quiet relaxation in the Activity Hub. Doug continues pestering people, and Lily chats with the fake plants in the Static Garden.",
    minuteLength: 120,
  },
  {
    id: "intra-evening-quiet",
    time: time("9:00 PM"),
    activity: "Quiet Time",
    description:
      "Quiet time in personal quarters or the Waiting Room, with Ama reminding everyone to reflect on their behavior.",
    minuteLength: 60,
  },
  {
    id: "intra-lights-out",
    time: time("10:00 PM"),
    activity: "Lights Out",
    description:
      "Ama dims the lights and bids a watchful goodnight: 'Rest well, citizens. I'll be keeping an eye on things.'",
    minuteLength: 60 * 8,
  },
];
