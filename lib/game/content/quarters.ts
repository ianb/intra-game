import { Room } from "../classes";

/**
 * One room per citizen, off the Hallway, plus the player's own. They are
 * near-identical in shape and differ only in their occupant's mark on them.
 */

export const Quarters_Doug = new Room({
  id: "Quarters_Doug",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Doug",
  excludeFromMap: true,
  shortDescription: `
    Doug's personal space, cluttered with random knick-knacks.
  `,
  description: `
    Doug's quarters are as chaotic as his thoughts, cluttered with an assortment of items that seem to have no particular order or meaning. It's cramped but comfortable, with random objects scattered on every surface.
  `,
  color: "text-rose-400",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Marta = new Room({
  id: "Quarters_Marta",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Marta",
  excludeFromMap: true,
  shortDescription: `
    Marta's pristine and perfectly organized quarters.
  `,
  description: `
    Marta's quarters are immaculate, with everything in its proper place. The room exudes an air of control and precision, with nothing out of order or left unattended.
  `,
  color: "text-pink-400",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Frida = new Room({
  id: "Quarters_Frida",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Frida",
  excludeFromMap: true,
  shortDescription: `
    Frida's room is scattered with papers and half-finished notes.
  `,
  description: `
    Frida's quarters are chaotic, with piles of paper, notes, and pens strewn across every surface. Her obsession with documenting every detail is evident in the mess.
  `,
  color: "text-yellow-500",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_June = new Room({
  id: "Quarters_June",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: June",
  excludeFromMap: true,
  shortDescription: `
    A minimalist space designed for tranquility, despite its tension.
  `,
  description: `
    June's quarters are minimalist and orderly, clearly meant to reflect calm and balance, though the occasional crooked picture or misplaced item reveals her struggle to maintain serenity.
  `,
  color: "text-teal-500",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Lana = new Room({
  id: "Quarters_Lana",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Lana",
  excludeFromMap: true,
  shortDescription: `
    Lana's quarters, carefully optimized for mood.
  `,
  description: `
    Lana's room is meticulously arranged, with every detail carefully planned to optimize mood and productivity. Subtle lighting changes and soft background music constantly shift the atmosphere.
  `,
  color: "text-green-400",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Harold = new Room({
  id: "Quarters_Harold",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Harold",
  excludeFromMap: true,
  shortDescription: `
    Harold's quarters, strictly organized with rulebooks everywhere.
  `,
  description: `
    Harold's quarters are rigidly structured, with neatly stacked rulebooks and guidelines on every surface. It's clear that order and control dominate every aspect of his personal space.
  `,
  color: "text-indigo-400",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Greg = new Room({
  id: "Quarters_Greg",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Greg",
  excludeFromMap: true,
  shortDescription: `
    Greg's quarters, understated and practical.
  `,
  description: `
    Greg's quarters are simple and functional, with only the bare necessities neatly arranged. It's a space that shows no frills, just practical, no-nonsense living.
  `,
  color: "text-slate-400",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Milton = new Room({
  id: "Quarters_Milton",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Milton",
  excludeFromMap: true,
  shortDescription: `
    Milton's quarters, filled with personal complaints and grievances.
  `,
  description: `
    Milton's quarters are cluttered and unkempt, with piles of written complaints and grievances strewn about. The room feels weighed down by his personal frustrations.
  `,
  color: "text-red-500",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Gloria = new Room({
  id: "Quarters_Gloria",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Gloria",
  excludeFromMap: true,
  shortDescription: `
    Gloria's quarters, neatly organized for overhearing everything.
  `,
  description: `
    Gloria's quarters are tidy and inviting, with a space clearly designed for hosting others' conversations. She seems prepared at all times to eavesdrop on passing discussions.
  `,
  color: "text-red-400",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Lily = new Room({
  id: "Quarters_Lily",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Lily",
  excludeFromMap: true,
  shortDescription: `
    Lily's quarters, brimming with plastic plants.
  `,
  description: `
    Lily's room is filled with plastic plants, each meticulously cared for as if they were alive. The space exudes a serene, if slightly odd, energy.
  `,
  color: "text-green-400",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Henry = new Room({
  id: "Quarters_Henry",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Henry",
  excludeFromMap: true,
  shortDescription: `
    Henry's quarters, a place of endless waiting.
  `,
  description: `
    Henry's room is simple and lived-in, a space clearly designed for waiting. Everything seems frozen in a state of anticipation, as though he could leave at any moment—or never.
  `,
  color: "text-blue-500",
  exits: [{ roomId: "Hallway" }],
});

export const Quarters_Yours = new Room({
  id: "Quarters_Yours",
  // A bedroom: off /nav, and anyone in one is not findable.
  onNav: false,
  name: "Quarters: Yours",
  shortDescription: `
    Your personal quarters, currently bare and empty.
  `,
  description: `
    Your quarters are almost completely empty, save for a simple bed and a small desk in the corner. The walls are bare, and the space feels temporary, as though it hasn't yet been fully inhabited. A faint hum of the ventilation system is the only sound, and the room smells faintly of cleaning solution, indicating it was freshly prepared for your arrival.
  `,
  color: "text-gray-300",
  exits: [{ roomId: "Hallway" }],
  soundtrack: {
    url: "Room_Quarters.mp3",
    sunoUrl: "https://suno.com/song/757602c6-cfa8-4aa4-96cc-e9d964bb4644",
  },
});
