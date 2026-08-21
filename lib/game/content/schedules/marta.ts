import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Marta's day. */
export const martaSchedule: PersonScheduleTemplateType[] = [
  {
    id: "marta-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Marta stretches elegantly, imagining an invisible audience applauding her flawless morning routine.",
    inside: ["Quarters_Marta"],
    attentive: false,
    early: 0,
    late: 5,
    minuteLength: 30,
  },
  {
    id: "marta-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Marta eats breakfast slowly, subtly reminding everyone around her of her 'Star Citizen' status with well-placed compliments.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "marta-morning-activity",
    time: time("8:45 AM"),
    activity: "Admire Statues in Hollow Atrium",
    description:
      "Marta walks gracefully through the Hollow Atrium, imagining herself immortalized in statue form.",
    inside: ["Hollow_Atrium"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 30,
  },
  {
    id: "marta-morning-leadership-advice",
    time: time("9:30 AM"),
    activity: "Offer Leadership Advice",
    description:
      "Marta casually offers advice to anyone nearby, referencing her 'Star Citizen' achievements as a blueprint for success.",
    inside: ["Hollow_Atrium"],
    attentive: true,
    early: 0,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "marta-posture",
    time: time("10:30 AM"),
    activity: "Perfect Posture Practice",
    description:
      "Marta practices her rigid, impeccable posture in front of any reflective surface she can find, ensuring her 'Star Citizen' grace is untouchable.",
    inside: ["Foyer"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 45,
  },
  {
    id: "marta-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Subtle Bragging",
    description:
      "Marta enjoys lunch at Joyous Café, ensuring to weave her 'Star Citizen' status into casual conversation while complimenting others' lesser efforts.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "marta-secret-self-doubt",
    time: time("1:30 PM"),
    activity: "Secret Self-Doubt Session",
    description:
      "In a rare moment of vulnerability, Marta slips into the Yellow Room alone and practices smiling, wondering if anyone truly notices her efforts.",
    inside: ["Yellow_Room"],
    attentive: false,
    early: 5,
    late: 15,
    minuteLength: 45,
    secret: true,
    secretReason:
      "Marta struggles with self-worth, despite her confident exterior.",
  },
  {
    id: "marta-afternoon-activity",
    time: time("2:15 PM"),
    activity: "Inspire Others in the Solitude Cubes",
    description:
      "Marta offers advice to those 'reflecting' in the Solitude Cubes, suggesting they aim for 'Star Citizen' levels of self-improvement.",
    inside: ["Solitude_Cubes"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 30,
  },
  {
    id: "marta-late-afternoon-activity",
    time: time("2:45 PM"),
    activity: "Inspire Others in the Solitude Cubes",
    description:
      "Marta offers advice to those 'reflecting' in the Solitude Cubes, suggesting they aim for 'Star Citizen' levels of self-improvement.",
    inside: ["Ill_Fitting_Lounge"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "marta-later-afternoon-activity",
    time: time("3:45 PM"),
    activity: "Inspire Others in the Solitude Cubes",
    description:
      "Marta offers advice to those 'reflecting' in the Solitude Cubes, suggesting they aim for 'Star Citizen' levels of self-improvement.",
    inside: ["Activity_Hub"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 150,
  },
  {
    id: "marta-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Attention Seeking",
    description:
      "Marta eats slowly, ensuring that everyone notices how composed she is under the dim lighting of Joyous Café.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 20,
    minuteLength: 120,
  },
  {
    id: "marta-evening-activity",
    time: time("8:30 PM"),
    activity: "Evening Stroll & Reflection",
    description:
      "Marta strolls through the Hollow Atrium, imagining herself being praised by Ama for her relentless dedication to perfection.",
    inside: ["Hollow_Atrium"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "marta-lights-out",
    time: time("9:30 PM"),
    activity: "Lights Out - Dream of Praise",
    description:
      "Marta lies in bed, visualizing receiving a grand award for being the perfect citizen, as Ama's voice whispers, 'Goodnight, Star Citizen.'",
    inside: ["Quarters_Marta"],
    attentive: false,
    early: 0,
    late: 15,
    minuteLength: 30,
  },
];
