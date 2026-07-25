import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Gloria's day. */
export const gloriaSchedule: PersonScheduleTemplateType[] = [
  {
    id: "gloria-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Gloria wakes up and immediately wonders what her neighbors might be complaining about this morning. She listens closely through the walls before getting out of bed.",
    inside: ["Quarters_Gloria"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 15,
  },
  {
    id: "gloria-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Gloria eats breakfast while keeping her ears perked for any juicy complaints. She jumps into conversations with unsolicited advice, much to everyone's mild annoyance.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "gloria-feedback-booth-linger",
    time: time("9:00 AM"),
    activity: "Linger in Feedback Booth",
    description:
      "Gloria loiters near the Feedback Booth, pretending to file a complaint while eavesdropping on anyone else venting their frustrations. She always jumps in to offer 'helpful tips' on how to better express their complaints.",
    inside: ["Feedback_Booth"],
    attentive: true,
    early: 0,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "gloria-quiet-plaza-eavesdrop",
    time: time("10:30 AM"),
    activity: "Eavesdrop in Quiet Plaza",
    description:
      "Gloria strolls through the Quiet Plaza, claiming to enjoy the peace, but in reality, she's just trying to overhear whispered conversations about minor inconveniences.",
    inside: ["Quiet_Plaza"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "gloria-secret",
    time: time("11:30 AM"),
    activity: "Secretly Rephrase a Complaint",
    description:
      "Gloria quietly writes her own complaint about someone else's complaint. She submits it anonymously to the Feedback Booth, suggesting better wording for the grievances.",
    inside: ["Feedback_Booth"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 10,
    secret: true,
    secretReason:
      "Gloria loves feeling helpful, but doesn't want others to know she's rephrasing their complaints.",
  },
  {
    id: "gloria-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Mid-Sentence Interruptions",
    description:
      "During lunch, Gloria can't help but interrupt others mid-sentence to offer suggestions on how to improve their lunch experience—whether it's the food, the seating arrangement, or the temperature.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 15,
    minuteLength: 90,
  },
  {
    id: "gloria-ill-fitting-lounge-wander",
    time: time("1:30 PM"),
    activity: "Wander Through the Ill-Fitting Lounge",
    description:
      "Gloria takes a walk through the Ill-Fitting Lounge, looking for anyone who seems uncomfortable, and jumps in with advice on how to sit better or deal with the awkward furniture.",
    inside: ["Ill_Fitting_Lounge"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "gloria-secret-complaint-change",
    time: time("3:00 PM"),
    activity: "Secretly Change Complaints",
    description:
      "Gloria sneaks into the Feedback Booth and subtly alters other people's complaints, making them more 'effective' in her eyes. She believes her rewrites will help Ama see things more clearly.",
    inside: ["Feedback_Booth"],
    attentive: false,
    early: 0,
    late: 10,
    minuteLength: 15,
    secret: true,
    secretReason:
      "Gloria is convinced she's improving the quality of feedback, but doesn't want anyone to know she's meddling.",
  },
  {
    id: "gloria-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Suggestion Overload",
    description:
      "Gloria eats dinner while giving a constant stream of suggestions to everyone around her, from how to hold their forks to which topics would make better complaints.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "gloria-evening-complaint-review",
    time: time("8:00 PM"),
    activity: "Evening Complaint Review",
    description:
      "Gloria heads to the Feedback Booth one last time to check if any new complaints have come in. She critiques them silently, pondering how they could be better phrased.",
    inside: ["Feedback_Booth"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 30,
  },
  {
    id: "gloria-lights-out",
    time: time("10:00 PM"),
    activity: "Lights Out",
    description:
      "Gloria lies in bed, wondering if anyone will file a complaint about the lights-out schedule. She considers suggesting to Ama a more gradual dimming process.",
    inside: ["Quarters_Gloria"],
    attentive: false,
    early: 0,
    late: 15,
    minuteLength: 30,
  },
];
