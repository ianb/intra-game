import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Lana's day. */
export const lanaSchedule: PersonScheduleTemplateType[] = [
  {
    id: "lana-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Lana wakes up and immediately adjusts the lighting in her quarters, convinced that a softer hue of blue will make her 10% more alert.",
    inside: ["Quarters_Lana"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 30,
  },
  {
    id: "lana-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Lana rearranges the tables in the café slightly, insisting that this new layout will increase digestion efficiency by 12%.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "lana-pool-lighting",
    time: time("8:45 AM"),
    activity: "Light Adjustment in the Tranquil Pool",
    description:
      "Lana adjusts the lighting in the Tranquil Pool, confident that a slightly pink hue will improve group harmony by 15%.",
    inside: ["Tranquil_Pool"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "lana-chair-alignment",
    time: time("10:00 AM"),
    activity: "Chair Alignment",
    description:
      "Lana meticulously moves the chairs in Joyous Café two inches closer to the windows, convinced this will foster collaboration and 'sun energy.'",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 45,
  },
  {
    id: "lana-mood-lighting",
    time: time("11:00 AM"),
    activity: "Consultation on Mood Lighting",
    description:
      "Lana approaches citizens in the Activity Hub, offering to adjust the lighting based on their moods, convinced that her purple lights will reduce stress levels by 8%.",
    inside: ["Activity_Hub"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "lana-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Color Theory",
    description:
      "Lana lectures anyone within earshot about how the color of their food trays impacts their productivity for the rest of the day. She recommends green trays for a 'balanced mental state.'",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "lana-furniture-feng-shui",
    time: time("2:00 PM"),
    activity: "Furniture Feng Shui Experiment",
    description:
      "Lana tests a new theory in the Solitude Cubes: if the chairs face north, she believes citizens will experience 10% deeper reflection. She spends time adjusting all the chairs in the cubicles.",
    inside: ["Solitude_Cubes"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "lana-secret-scent-experiment",
    time: time("3:00 PM"),
    activity: "Secret Scent Experiment",
    description:
      "Lana sneaks into the Static Garden to spritz the air with a lavender-scented spray she made, convinced it will secretly enhance 'emotional coherence.' She hides the bottle behind a plastic plant.",
    inside: ["Static_Garden"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 10,
    secret: true,
    secretReason:
      "Lana believes Ama doesn't appreciate her 'advanced' scent experiments and doesn't want her efforts to be interfered with.",
  },
  {
    id: "lana-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Mood Optimization",
    description:
      "Lana adjusts the position of plates and utensils at her dinner table, explaining to everyone how the right setup can improve 'mindful eating' by 12%.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "lana-evening-review",
    time: time("8:00 PM"),
    activity: "Evening Review",
    description:
      "Lana reviews the day's mood-optimizing efforts, jotting down 'scientific' results in her personal journal, noting that the lighting in the café needs to be 5% warmer for dinner tomorrow.",
    inside: ["Quarters_Lana"],
    attentive: false,
    early: 0,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "lana-lights-out",
    time: time("9:30 PM"),
    activity: "Lights Out & Calm Reflection",
    description:
      "Lana dims the lights in her quarters, setting them to a soothing amber hue, convinced it will lead to 20% better sleep quality.",
    inside: ["Quarters_Lana"],
    attentive: false,
    early: 5,
    late: 15,
    minuteLength: 60,
  },
];
