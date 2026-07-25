import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Harold's day. */
export const haroldSchedule: PersonScheduleTemplateType[] = [
  {
    id: "harold-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Harold wakes up promptly, taking notes on the exact timing of the chime to ensure it meets 'Intra Wake-Up Standards,' Section 3, Paragraph 2.",
    inside: ["Quarters_Harold"],
    attentive: false,
    early: 0,
    late: 5,
    minuteLength: 15,
  },
  {
    id: "harold-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Harold inspects the café for infractions, such as 'Incorrect Tray Placement' and 'Improper Coffee Stirring,' while reminding citizens to follow meal guidelines.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "harold-activity-hub-patrol",
    time: time("8:30 AM"),
    activity: "Enforce Rules in Activity Hub",
    description:
      "Harold patrols the Activity Hub, issuing stern warnings about improper use of equipment, such as 'Unapproved Nap Postures' in the Extreme Resting area.",
    inside: ["Activity_Hub"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 120,
  },
  {
    id: "harold-rule-update",
    time: time("10:30 AM"),
    activity: "Rule Update",
    description:
      "Harold takes a break to update his self-created rulebook, adding new regulations for chair positioning and 'Appropriate Levels of Relaxation' in communal areas.",
    inside: ["Activity_Hub"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "harold-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Observation",
    description:
      "During lunch, Harold meticulously observes the room for any violations of dining protocol, like 'Excessive Chewing' or 'Unsanctioned Utensil Angles.'",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "harold-lecture",
    time: time("1:30 PM"),
    activity: "Lecture on Proper Behavior",
    description:
      "Harold offers an impromptu lecture to citizens in the Activity Hub about the importance of following guidelines, citing Section 4: 'Appropriate Conduct in Shared Spaces.'",
    inside: ["Activity_Hub"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "harold-secret-rule-break",
    time: time("3:00 PM"),
    activity: "Secret Rule Break",
    description:
      "Harold sneaks into a secluded corner and takes a nap in a non-approved position, feeling a bit guilty but oddly refreshed afterward.",
    inside: ["Solitude_Cubes"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 10,
    secret: true,
    secretReason:
      "Harold feels immense guilt about breaking his own rules but secretly enjoys these tiny acts of rebellion.",
  },
  {
    id: "harold-activity-hub-monitor",
    time: time("4:00 PM"),
    activity: "Monitor Activity Hub for Infractions",
    description:
      "Harold resumes his patrolling of the Activity Hub, monitoring for infractions like 'Incorrect Use of Exercise Equipment' and 'Unauthorized Resting.'",
    inside: ["Activity_Hub"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "harold-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Rule Enforcement",
    description:
      "Harold eats dinner while scanning the room for minor infractions, such as 'Unapproved Napkin Folding Techniques.'",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "harold-rule-review",
    time: time("8:00 PM"),
    activity: "Nighttime Rule Review",
    description:
      "Harold spends time in his quarters reviewing and revising his rulebook, contemplating adding a new chapter on 'Proper Lighting for Relaxation.'",
    inside: ["Quarters_Harold"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "harold-lights-out",
    time: time("9:50 PM"),
    activity: "Lights Out",
    description:
      "Harold goes to bed after adjusting the blanket to exactly 90 degrees, according to his own 'Sleep Efficiency' guidelines.",
    inside: ["Quarters_Harold"],
    attentive: false,
    early: 0,
    late: 10,
    minuteLength: 30,
  },
];
