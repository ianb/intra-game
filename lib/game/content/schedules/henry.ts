import type { PersonScheduleTemplateType } from "../../../types";
import { time } from "./time";

/** Henry's day. */
export const henrySchedule: PersonScheduleTemplateType[] = [
  {
    id: "henry-wake-up",
    time: time("6:00 AM"),
    activity: "Wake-up Chime",
    description:
      "Henry wakes up with a calm smile, flipping through the same old magazine, convinced that today might finally be the day his appointment is called.",
    inside: ["Quarters_Henry"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 30,
  },
  {
    id: "henry-breakfast",
    time: time("7:00 AM"),
    activity: "Breakfast at Joyous Café",
    description:
      "Henry eats breakfast at a relaxed pace, reading a magazine he's read hundreds of times. He occasionally looks around as if expecting Ama to call his name over the intercom for his long-awaited appointment.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "henry-waiting-room",
    time: time("9:00 AM"),
    activity: "Sit in Waiting Room",
    description:
      "Henry calmly sits in the Waiting Room, flipping through magazines. He smiles patiently, always hopeful that his appointment with Ama will come soon.",
    inside: ["Waiting_Room"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 120,
  },
  {
    id: "henry-polite-inquiry",
    time: time("11:30 AM"),
    activity: "Polite Inquiry at Feedback Booth",
    description:
      "Henry politely asks the Feedback Booth if there's been any updates on his appointment. He accepts the lack of information with a calm nod, 'No rush, I'm sure they'll get to me soon.'",
    inside: ["Feedback_Booth"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 30,
  },
  {
    id: "henry-lunch",
    time: time("12:00 PM"),
    activity: "Lunch & Optimistic Conversations",
    description:
      "Henry enjoys lunch, casually chatting with others about how today might finally be the day. He maintains a polite, optimistic tone, assuring everyone that patience is key.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "henry-relaxation",
    time: time("2:00 PM"),
    activity: "Relaxation in Waiting Room",
    description:
      "Henry returns to the Waiting Room, where he calmly sits with his hands folded, waiting patiently while pretending to read another old magazine. His anticipation is unspoken, but clear in his hopeful gaze at the door.",
    inside: ["Waiting_Room"],
    attentive: true,
    early: 0,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "henry-secret-frustration",
    time: time("3:30 PM"),
    activity: "Secret Frustration Release",
    description:
      "In a rare moment of frustration, Henry sneaks into a storage closet and quietly mutters about how long he's been waiting. 'It's been years... maybe tomorrow. Maybe.' He quickly regains composure before anyone notices.",
    inside: ["Utility_Closet"],
    attentive: false,
    early: 5,
    late: 10,
    minuteLength: 10,
    secret: true,
    secretReason:
      "Henry doesn't want others to see him lose patience, even briefly.",
  },
  {
    id: "henry-hopeful-waiting",
    time: time("4:00 PM"),
    activity: "Hopeful Waiting",
    description:
      "Henry returns to the Waiting Room once again, maintaining his patient demeanor. He takes deep breaths and tells himself, 'Today could still be the day.'",
    inside: ["Waiting_Room"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "henry-dinner",
    time: time("6:00 PM"),
    activity: "Dinner & Friendly Optimism",
    description:
      "Henry eats dinner with a calm smile, chatting with anyone nearby about how Ama surely has important things to do, and he's happy to wait. 'No need to rush,' he says, though there's a faint edge to his voice.",
    inside: ["Joyous_Cafe"],
    attentive: true,
    early: 5,
    late: 10,
    minuteLength: 90,
  },
  {
    id: "henry-evening-waiting",
    time: time("8:00 PM"),
    activity: "Evening Waiting Routine",
    description:
      "Henry returns to the Waiting Room for one last sit before bed. He spends his time mentally rehearsing what he'll say when his appointment is finally called. His tone is still calm, but his eyes flicker with hope.",
    inside: ["Waiting_Room"],
    attentive: false,
    early: 0,
    late: 10,
    minuteLength: 60,
  },
  {
    id: "henry-lights-out",
    time: time("10:00 PM"),
    activity: "Lights Out",
    description:
      "Henry lies in bed, telling himself that tomorrow will be the day. 'Any day now,' he whispers to the ceiling, before falling into a peaceful sleep.",
    inside: ["Quarters_Henry"],
    attentive: false,
    early: 0,
    late: 15,
    minuteLength: 30,
  },
];
