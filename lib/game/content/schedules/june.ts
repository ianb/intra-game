import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** June's day. */
export const juneSchedule: PersonScheduleTemplateType[] = [
  {
    id: "june-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "June practices her deep breathing to center herself for the day.",
    inside: ["Quarters_June"],
    attentive: false,
    early: 0,
    late: 15,
    minuteLength: 30,
  },
  {
    id: "june-breakfast",
    time: time("7:00 AM"),
    activity: "Eat breakfast",
    description:
      "June eats slowly and methodically, offering calming advice to those around her.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 15,
    late: 20,
    minuteLength: 120,
  },
  {
    id: "june-morning-work",
    time: time("9:00 AM"),
    activity: "Sit by the pool",
    description:
      "June sits cross-legged by the Tranquil Pool, projecting forced calm.",
    inside: ["Tranquil_Pool"],
    attentive: true,
    early: 10,
    late: 30,
    minuteLength: 60,
  },
  {
    id: "june-morning-adjust",
    time: time("10:00 AM"),
    activity: "Adjust robes",
    description:
      "June spends time readjusting her robes, making every movement as slow and deliberate as possible.",
    inside: ["Tranquil_Pool"],
    attentive: false,
    early: 5,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "june-sighs",
    time: time("11:00 AM"),
    activity: "Suppress a sigh",
    description:
      "June attempts to suppress her frustration when someone interrupts her.",
    inside: ["Tranquil_Pool"],
    attentive: false,
    early: 10,
    late: 10,
    minuteLength: 5,
    secret: true,
    secretReason:
      "June hides how close she comes to snapping under her forced tranquility.",
  },
  {
    id: "june-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Reflection",
    description: "June eats slowly, offering serenity advice to anyone nearby.",
    inside: ["Solitude_Cubes", "Ill_Fitting_Lounge"],
    attentive: true,
    early: 5,
    late: 25,
    minuteLength: 90,
  },
  {
    id: "june-afternoon-work",
    time: time("1:30 PM"),
    activity: "Guided meditation",
    description:
      "June leads a quiet meditation session, though her voice sometimes trembles.",
    inside: ["Tranquil_Pool"],
    attentive: true,
    early: 10,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "june-afternoon-adjust",
    time: time("3:00 PM"),
    activity: "Hide and scream",
    description:
      "June sneaks into a secluded corner and lets out a quick scream to release tension.",
    inside: ["Hallway", "Foyer"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 5,
    secret: true,
    secretReason:
      "June is desperate to maintain her facade, but she needs these moments to release frustration.",
  },
  {
    id: "june-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Quiet Conversation",
    description:
      "June offers others more calm words during dinner, though she avoids Doug.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 10,
    late: 30,
    minuteLength: 120,
  },
  {
    id: "june-evening-quiet",
    time: time("8:00 PM"),
    activity: "Evening relaxation",
    description:
      "June practices breathing exercises before bed, trying to maintain her fragile calm.",
    inside: ["Quarters_June"],
    attentive: false,
    early: 5,
    late: 60,
    minuteLength: 120,
  },
];
