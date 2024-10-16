import { GeneralScheduleType, PersonScheduleTemplateType } from "../types";

function time(timeString: string): number {
  const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/;
  const match = timeString.trim().match(timeRegex);
  if (!match) {
    throw new Error("Invalid time format");
  }
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3].toLowerCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    throw new Error("Invalid time range");
  }
  if (period === "pm" && hours !== 12) {
    hours += 12;
  } else if (period === "am" && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}

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

export const schedules: Record<string, PersonScheduleTemplateType[]> = {
  June: [
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
      description:
        "June eats slowly, offering serenity advice to anyone nearby.",
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
      inside: ["Utility_Closet", "Reflection_Chamber"],
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
  ],

  Marta: [
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
      id: "marta-afternoon-activity",
      time: time("2:00 PM"),
      activity: "Inspire Others in the Solitude Cubes",
      description:
        "Marta offers advice to those 'reflecting' in the Solitude Cubes, suggesting they aim for 'Star Citizen' levels of self-improvement.",
      inside: ["Solitude_Cubes"],
      attentive: true,
      early: 5,
      late: 10,
      minuteLength: 60,
    },
    {
      id: "marta-secret-self-doubt",
      time: time("3:00 PM"),
      activity: "Secret Self-Doubt Session",
      description:
        "In a rare moment of vulnerability, Marta slips into a private corner and practices smiling alone, wondering if anyone truly notices her efforts.",
      inside: ["Utility_Closet", "Reflection_Chamber"],
      attentive: false,
      early: 5,
      late: 15,
      minuteLength: 10,
      secret: true,
      secretReason:
        "Marta struggles with self-worth, despite her confident exterior.",
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
  ],

  Frida: [
    {
      id: "frida-wake-up",
      time: time("6:00 AM"),
      activity: "Wake-up Chime",
      description:
        "Frida starts her day by scribbling down her dreams, convinced they might contain valuable information about Intra.",
      inside: ["Quarters_Frida"],
      attentive: false,
      early: 5,
      late: 10,
      minuteLength: 30,
    },
    {
      id: "frida-breakfast",
      time: time("7:00 AM"),
      activity: "Breakfast at Joyous Café",
      description:
        "Frida eats while taking rapid notes on the exact composition of the food, noting changes in texture that might indicate a hidden message.",
      inside: ["Joyous_Cafe"],
      attentive: true,
      early: 5,
      late: 10,
      minuteLength: 60,
    },
    {
      id: "frida-archive-dive",
      time: time("8:15 AM"),
      activity: "Archive Dive",
      description:
        "Frida rushes into the Archive Lounge, arms full of papers. She begins furiously documenting every minor inconsistency she finds, convinced there's a deeper meaning.",
      inside: ["Archive_Lounge"],
      attentive: true,
      early: 0,
      late: 15,
      minuteLength: 120,
    },
    {
      id: "frida-theory-break",
      time: time("10:15 AM"),
      activity: "Quick Theory Break",
      description:
        "Frida stops mid-documentation to develop a wild theory about the origins of Intra's malfunctioning sky screens, which she immediately starts scribbling down.",
      inside: ["Archive_Lounge"],
      attentive: true,
      early: 5,
      late: 10,
      minuteLength: 30,
    },
    {
      id: "frida-odd-files",
      time: time("11:00 AM"),
      activity: "Track Down Odd Files",
      description:
        "Frida dashes around the Archive Lounge, hunting for strange files she believes might hold the key to the mysterious 'Sentra.'",
      inside: ["Archive_Lounge"],
      attentive: true,
      early: 0,
      late: 15,
      minuteLength: 60,
    },
    {
      id: "frida-lunch",
      time: time("12:00 PM"),
      activity: "Lunch & Scatterbrain Conversation",
      description:
        "Frida attempts to eat lunch but keeps interrupting herself to speculate about strange anomalies in the data she's found.",
      inside: ["Joyous_Cafe"],
      attentive: true,
      early: 5,
      late: 20,
      minuteLength: 90,
    },
    {
      id: "frida-conspiracy-brainstorm",
      time: time("1:30 PM"),
      activity: "Conspiracy Brainstorm",
      description:
        "Frida sits in the corner of the Archive Lounge, piecing together unrelated data points into an elaborate conspiracy theory, occasionally forgetting where she was going with it.",
      inside: ["Archive_Lounge"],
      attentive: true,
      early: 5,
      late: 10,
      minuteLength: 90,
    },
    {
      id: "frida-secret-data-stash",
      time: time("3:00 PM"),
      activity: "Secret Data Stash",
      description:
        "Frida sneaks into a hidden corner of the Archive Lounge to stash away a folder of documents she believes Ama doesn't want anyone to see. She hides them under a loose floor tile.",
      inside: ["Archive_Lounge"],
      attentive: false,
      early: 0,
      late: 5,
      minuteLength: 10,
      secret: true,
      secretReason:
        "Frida thinks she's onto something about 'Sentra' and is afraid Ama will find out.",
    },
    {
      id: "frida-dinner",
      time: time("6:00 PM"),
      activity: "Dinner & Wild Speculations",
      description:
        "Frida absentmindedly pokes at her dinner while continuing to ramble about bizarre theories, offering them to anyone nearby, whether they want to hear them or not.",
      inside: ["Joyous_Cafe"],
      attentive: true,
      early: 5,
      late: 15,
      minuteLength: 90,
    },
    {
      id: "frida-late-night-data-sorting",
      time: time("8:00 PM"),
      activity: "Late-Night Data Sorting",
      description:
        "Frida stays up late, sorting through mountains of papers and old files, often muttering things like 'No, this can't be right… or can it?'",
      inside: ["Archive_Lounge"],
      attentive: true,
      early: 0,
      late: 10,
      minuteLength: 120,
    },
    {
      id: "frida-lights-out",
      time: time("9:30 PM"),
      activity: "Lights Out - Last-Minute Jotting",
      description:
        "Frida tries to sleep but keeps jumping up to jot down last-minute thoughts in her journal, convinced that something important will come to her just as she falls asleep.",
      inside: ["Quarters_Frida"],
      attentive: false,
      early: 5,
      late: 10,
      minuteLength: 60,
    },
  ],

  Doug: [
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
  ],

  Lana: [
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
  ],

  Harold: [
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
  ],

  Greg: [
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
  ],

  Gloria: [
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
  ],

  Lily: [
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
  ],

  Henry: [
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
  ],
};
