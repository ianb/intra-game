import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Doug's day. */
export const dougSchedule: PersonScheduleTemplateType[] = [
  {
    id: "doug-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Doug wakes up full of questions and immediately wonders aloud why the chime is always the same tone. 'Couldn't they change it up a bit? I bet a cowbell would be fun!'",
    inside: ["Quarters_Doug"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 15,
  },
  {
    id: "doug-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Doug eats breakfast while pestering everyone around him with random thoughts, like, 'Do you think the coffee machine has feelings? It gets used an awful lot.'",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "doug-pool-wander",
    time: time("8:45 AM"),
    activity: "Pace Around the Tranquil Pool",
    description:
      "Doug wanders around the Tranquil Pool, asking anyone nearby, 'How deep do you think this pool is? I bet it's deep enough to hide a submarine, don't you think?'",
    inside: ["Tranquil_Pool"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "doug-meditation-disruption",
    time: time("10:00 AM"),
    activity: "Disrupt June's Meditation",
    description:
      "Doug interrupts June's meditation with an enthusiastic, 'Do you ever think about how long it takes the sky screens to load that sunset? Like, what if it glitched and showed a sunrise instead? That'd be wild, right?'",
    inside: ["Tranquil_Pool"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 45,
  },
  {
    id: "doug-activity-hub-annoyance",
    time: time("11:00 AM"),
    activity: "Annoy Harold in the Activity Hub",
    description:
      "Doug enters the Activity Hub and asks Harold, 'Why are all the machines here broken? Do you think it's some kind of conspiracy? I bet Ama's hiding something.'",
    inside: ["Activity_Hub"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "doug-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Random Questions",
    description:
      "Doug eats lunch while offering unsolicited commentary: 'Do you think these protein packs come from real plants? Or is it like... fake plant-flavored stuff? Also, what even is protein, really?'",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "doug-solitude-cubes-pondering",
    time: time("2:00 PM"),
    activity: "Pondering in the Solitude Cubes",
    description:
      "Doug quietly sneaks into the Solitude Cubes, but can't resist talking to the person in the next cube: 'Hey, do you think these cubes are soundproof? Because I can hear you breathing.'",
    inside: ["Solitude_Cubes"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "doug-secret-star-counting",
    time: time("3:00 PM"),
    activity: "Secretly Try to Count the Stars",
    description:
      "Doug sits in the Solitude Cubes, trying to count the stars on the ceiling, but he loses track constantly and ends up muttering to himself about constellations that probably don't exist.",
    inside: ["Solitude_Cubes"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 20,
    secret: true,
    secretReason:
      "Doug secretly wants to believe he'll find a pattern in the stars that no one else has noticed.",
  },
  {
    id: "doug-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Pointless Theories",
    description:
      "Doug eats dinner while presenting his latest theory: 'So, what if Ama's just a really advanced toaster? Hear me out—she's always popping up when you don't need her, just like burnt toast!'",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "doug-evening-wander",
    time: time("8:00 PM"),
    activity: "Evening Wander & Inane Questions",
    description:
      "Doug strolls through Intra, stopping random citizens to ask things like, 'What do you think would happen if we all wore hats made of aluminum foil? Just for a day, y'know, to see what Ama thinks.'",
    inside: ["Hollow_Atrium"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "doug-lights-out",
    time: time("9:30 PM"),
    activity: "Lights Out & Last-Minute Thoughts",
    description:
      "Doug lies in bed, wondering, 'Why are we even here, anyway? I bet it's some kind of elaborate science experiment, but who's watching? Do they take notes?' He falls asleep mid-thought.",
    inside: ["Quarters_Doug"],
    attentive: false,
    early: 0,
    late: 10,
    minuteLength: 60,
  },
];
