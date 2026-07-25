import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Greg's day. */
export const gregSchedule: PersonScheduleTemplateType[] = [
  {
    id: "greg-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Greg wakes up slowly, taking his time to stretch and check the schedule of repairs he probably won't follow. He prefers to handle things as they come.",
    inside: ["Quarters_Greg"],
    attentive: false,
    early: 5,
    late: 15,
    minuteLength: 30,
  },
  {
    id: "greg-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Greg eats breakfast quietly, listening to others but rarely chiming in. If anyone asks, he'll casually mention that some vent somewhere needs fixing, but it's not urgent.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "greg-intra-wander",
    time: time("9:00 AM"),
    activity: "Wander Around Intra",
    description:
      "Greg wanders the halls of Intra, checking on various systems, but mostly observing the decay without rushing to fix it. He's seen it all before.",
    inside: ["Activity_Hub"],
    attentive: true,
    early: 0,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "greg-secret-smoke-break",
    time: time("10:30 AM"),
    activity: "Secret Smoke Break",
    description:
      "Greg sneaks off to a secluded utility closet for a 'smoke break' with an old electronic cigarette he found years ago. He doesn't smoke, but he likes the break.",
    inside: ["Utility_Closet"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 10,
    secret: true,
    secretReason:
      "Greg doesn't want anyone to know he's been slacking off for years. Plus, Ama might not approve of 'pointless breaks.'",
  },
  {
    id: "greg-tinker-time",
    time: time("11:00 AM"),
    activity: "Tinker with Forgotten Machines",
    description:
      "Greg spends some time tinkering with old, forgotten machines in hidden corners of Intra. He knows they aren't important, but it gives him something to do.",
    // FIXME: this isn't a great location for this:
    inside: ["Solitude_Cubes"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "greg-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Casual Chat",
    description:
      "Greg eats lunch, responding with vague but friendly answers when others ask about his work. He knows about 'Sentra,' but doesn't bring it up unless someone does first.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "greg-pretend-check",
    time: time("2:00 PM"),
    activity: "Pretend to Check Systems",
    description:
      "Greg checks various systems, but mostly just stands around watching them work or not work. He'll fix things only if absolutely necessary, or if someone's watching.",
    // FIXME: this isn't a great location for this:
    inside: ["Static_Garden"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "greg-secret-explore",
    time: time("3:30 PM"),
    activity: "Explore Off-Limits Areas",
    description:
      "Greg quietly slips into areas Ama can't monitor, places he's found over the years. He doesn't talk about them much, but if asked, he'll shrug and say, 'I've been there.'",
    inside: ["Void"],
    attentive: false,
    early: 10,
    late: 15,
    minuteLength: 45,
    secret: true,
    secretReason:
      "Greg enjoys the peace of the unmonitored areas and keeps them to himself, relishing the quiet freedom.",
  },
  {
    id: "greg-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Casual Conversations",
    description:
      "Greg sits quietly at dinner, listening more than talking. If pressed, he'll mention some odd repairs he's done, always in a calm, matter-of-fact way.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "greg-evening-stroll",
    time: time("8:00 PM"),
    activity: "Evening Stroll",
    description:
      "Greg takes an evening stroll around Intra, stopping to inspect pipes and vents, not really fixing anything but making a mental note of what might need repair tomorrow… or next week.",
    inside: ["Hollow_Atrium"],
    attentive: false,
    early: 5,
    late: 15,
    minuteLength: 60,
  },
  {
    id: "greg-lights-out",
    time: time("9:45 PM"),
    activity: "Lights Out",
    description:
      "Greg goes to bed after a long day of doing just enough. He falls asleep thinking about a vent he fixed years ago and wonders if it's still working. He'll check tomorrow... maybe.",
    inside: ["Quarters_Greg"],
    attentive: false,
    early: 0,
    late: 15,
    minuteLength: 30,
  },
];
