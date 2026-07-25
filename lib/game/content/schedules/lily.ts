import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Lily's day. */
export const lilySchedule: PersonScheduleTemplateType[] = [
  {
    id: "lily-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Lily wakes up and immediately wonders how her 'babies' (the fake plants) fared overnight. She whispers soothing words to her potted plastic companions, promising to visit them soon.",
    inside: ["Quarters_Lily"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 15,
  },
  {
    id: "lily-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Lily eats breakfast while quietly observing the people around her. She contemplates whether they would benefit from 'plant therapy' and considers inviting them to visit the garden.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "lily-morning-care",
    time: time("9:00 AM"),
    activity: "Morning Care in Static Garden",
    description:
      "Lily tends to the plastic plants in the Static Garden, talking to them gently. She waters them with a small spray bottle and whispers, 'Look at you, so green and vibrant today!'",
    inside: ["Static_Garden"],
    attentive: true,
    early: 0,
    late: 15,
    minuteLength: 120,
  },
  {
    id: "lily-secret-naming",
    time: time("11:30 AM"),
    activity: "Secret Naming Ceremony",
    description:
      "Lily quietly holds a secret 'naming ceremony' for a new plastic fern she recently found in the back of a storage room. She names it 'Fluffy' and makes a small ceremony out of its placement.",
    inside: ["Static_Garden"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 15,
    secret: true,
    secretReason:
      "Lily feels the need to keep the ceremony private, as she believes others wouldn't understand the importance of naming her plants.",
  },
  {
    id: "lily-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Plant Contemplation",
    description:
      "Lily eats lunch while thinking about what the plants in the Static Garden might need next. She decides that tomorrow she'll bring them extra 'sunlight' by adjusting the artificial lights.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "lily-afternoon-whispering",
    time: time("2:00 PM"),
    activity: "Afternoon Plant Whispering",
    description:
      "Lily returns to the Static Garden, sitting among the plants and whispering to them about the day's events. She asks them how they feel and imagines their responses.",
    inside: ["Static_Garden"],
    attentive: true,
    early: 0,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "lily-secret-leaf-polishing",
    time: time("3:30 PM"),
    activity: "Secret Leaf Polishing",
    description:
      "Lily sneaks into the Static Garden with a special cloth to secretly polish the leaves of the plants. She believes this helps them 'breathe better,' even though they're fake.",
    inside: ["Static_Garden"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 20,
    secret: true,
    secretReason:
      "Lily keeps this activity a secret, fearing others might laugh at her for polishing plastic leaves.",
  },
  {
    id: "lily-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Daydreaming About Plants",
    description:
      "Lily eats dinner while daydreaming about expanding the Static Garden with new plants she's heard rumors about, like 'artificial bamboo' or 'synthetic moss.'",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "lily-evening-walk",
    time: time("8:00 PM"),
    activity: "Evening Walk Through the Garden",
    description:
      "Lily takes an evening stroll through the Static Garden, checking on each plant and telling them a bedtime story about a peaceful forest. She pats them gently before leaving.",
    inside: ["Static_Garden"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "lily-lights-out",
    time: time("9:00 PM"),
    activity: "Lights Out",
    description:
      "Lily goes to bed after promising the plants she'll visit them first thing in the morning. She lies in bed thinking about how to rearrange the garden to give 'everyone' more sunlight.",
    inside: ["Quarters_Lily"],
    attentive: false,
    early: 0,
    late: 15,
    minuteLength: 30,
  },
];
