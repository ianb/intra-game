import { RoomDefinitionType } from "../types";
import { tmpl } from "../template";
import type { Model } from "../model";

export const rooms: RoomDefinitionType[] = [
  {
    id: "room:intake",
    name: "Intake",
    shortDescription: `
    A small room with a padded examination table.
    `,
    description: tmpl`
    A small room with a padded examination table. The walls are lined with inscrutable equipment and screens, many of them non-functioning.
    `,
    color: "text-lime-500",
    exits: [
      {
        roomId: "room:foyer",
      },
    ],

    async onEvent(event: string, model: Model) {
      if (event === "enter") {
        console.log("entered", this.state.hasEntered);
        if (this.state.hasEntered) {
          return;
        }
        model.updateState(this.id, { hasEntered: true });
        model.sendEvent("amaIntro");
      }
    },
  },
  {
    id: "room:foyer",
    name: "Intake Foyer",
    shortDescription: `
    A simple room that serves only as a passage.
    `,
    description: tmpl`
    A small room, a passage from the intake area.
    `,
    color: "text-emerald-500",
    exits: [
      {
        roomId: "room:intake",
      },
      {
        roomId: "room:hollow_atrium",
      },
    ],
  },

  {
    id: "room:hollow_atrium",
    name: "The Hollow Atrium",
    shortDescription: `
      A vast, empty space beneath a frozen sunset.
    `,
    description: tmpl`
      A large, open room lit by an orange glow from the sky screens above, which display an unchanging sunset.
      Dusty statues of citizens stand along the walls, their faces worn smooth.
      The sound of distant thunder plays occasionally, though no storm ever arrives.
      The room is mostly empty, with the sound of footsteps echoing against the high ceilings.
    `,
    color: "text-orange-500",
    exits: [
      {
        roomId: "room:foyer",
      },
      {
        roomId: "room:archive_lounge",
      },
      {
        roomId: "room:activity_hub",
      },
    ],
  },

  {
    id: "room:archive_lounge",
    name: "Archive Lounge",
    shortDescription: `
      A quiet room with malfunctioning screens and a vending machine.
    `,
    description: tmpl`
      A small, quiet room lined with old, glitching monitors displaying unreadable data.
      A vending machine hums quietly in the corner, offering unlabeled drinks.
      The sky above is a pixelated blue with occasional bursts of static, flashing error messages before resetting.
    `,
    color: "text-blue-500",
    exits: [
      {
        roomId: "room:hollow_atrium",
      },
      {
        roomId: "room:tranquil_pool",
      },
    ],
  },

  {
    id: "room:tranquil_pool",
    name: "Tranquil Pool",
    shortDescription: `
      A still pool surrounded by plastic plants.
    `,
    description: tmpl`
      A small room centered around a perfectly still pool of water.
      Plastic plants line the edges, their colors too vibrant to be real.
      Above, the sky glows with a pink and orange sunset, the horizon flickering slightly as though it’s struggling to hold together.
    `,
    color: "text-pink-500",
    exits: [
      {
        roomId: "room:archive_lounge",
      },
      {
        roomId: "room:joyous_cafe",
      },
    ],
  },

  {
    id: "room:joyous_cafe",
    name: "Joyous Café",
    shortDescription: `
      A cheerful dining area with shifting decor.
    `,
    description: tmpl`
      Bright flowers adorn the walls, though their color shifts with the hour.
      Tables are neatly arranged, while upbeat music plays softly in the background.
      The ceiling shows a sky of drifting clouds, though their speed changes without warning, sometimes halting mid-drift.
    `,
    color: "text-yellow-500",
    exits: [
      {
        roomId: "room:tranquil_pool",
      },
      {
        roomId: "room:activity_hub",
      },
    ],
  },

  {
    id: "room:activity_hub",
    name: "Activity Hub",
    shortDescription: `
      A recreation space filled with odd, outdated equipment.
    `,
    description: tmpl`
      An open room filled with mismatched exercise equipment.
      Some machines are broken, while others seem built for activities no one remembers.
      Citizens often gather around a section for "extreme resting," competing to see who can nap the longest.
      The ceiling shows a clear sky, though birds sometimes fly backward or in loops.
    `,
    color: "text-cyan-500",
    exits: [
      {
        roomId: "room:hollow_atrium",
      },
      {
        roomId: "room:joyous_cafe",
      },
    ],
  },

  {
    id: "room:yellow_room",
    name: "The Yellow Room",
    shortDescription: `
      A bright yellow room with a single chair.
    `,
    description: tmpl`
      The walls, floor, and ceiling are all painted a vibrant yellow.
      A single, uncomfortable chair sits in the center of the room, facing nothing in particular.
      Above, a static blue sky with large, fluffy clouds provides a strange sense of calm, though the clouds never move.
    `,
    color: "text-yellow-600",
    exits: [
      {
        roomId: "room:solitude_cubes",
      },
    ],
  },

  {
    id: "room:nursery",
    name: "The Nursery",
    shortDescription: `
      A cheerful room filled with toys and cribs.
    `,
    description: tmpl`
      A brightly decorated room with neatly arranged toys, cribs, and colorful murals.
      Everything is in perfect condition, as if waiting for use.
      Above, the ceiling shows a sky filled with floating balloons and confetti, creating a perpetual birthday atmosphere.
    `,
    color: "text-purple-500",
    exits: [
      {
        roomId: "room:hollow_atrium",
      },
    ],
  },

  {
    id: "room:solitude_cubes",
    name: "The Solitude Cubes",
    shortDescription: `
      Small cubicles for quiet reflection.
    `,
    description: tmpl`
      Rows of tiny, cramped cubicles line the room, each barely large enough to sit in.
      The walls are thin, allowing faint voices from other cubes to be heard.
      The ceiling displays a peaceful night sky with twinkling stars, though a voice occasionally announces the trajectory of a shooting star.
    `,
    color: "text-indigo-500",
    exits: [
      {
        roomId: "room:yellow_room",
      },
      {
        roomId: "room:ill_fitting_lounge",
      },
    ],
  },

  {
    id: "room:ill_fitting_lounge",
    name: "The Ill-Fitting Lounge",
    shortDescription: `
      A relaxation space with poorly sized furniture.
    `,
    description: tmpl`
      Chairs, tables, and sofas are scattered around the room, but none are the right size.
      Every chair is slightly too small or too low, every table is slightly too tall.
      Above, the ceiling shows a serene beach, though the waves move unnaturally slow, as if in a dream.
    `,
    color: "text-green-500",
    exits: [
      {
        roomId: "room:solitude_cubes",
      },
      {
        roomId: "room:quiet_plaza",
      },
    ],
  },

  {
    id: "room:feedback_booth",
    name: "The Feedback Booth",
    shortDescription: `
      A small booth for submitting complaints and feedback.
    `,
    description: tmpl`
      A cozy, narrow booth where citizens can submit their complaints or suggestions via a glowing terminal.
      Many citizens stop by to vent their frustrations, making it an unexpected social hub.
      The ceiling shows a clear sky, with paper airplanes drifting lazily across it in all directions.
    `,
    color: "text-gray-500",
    exits: [
      {
        roomId: "room:quiet_plaza",
      },
    ],
  },

  {
    id: "room:static_garden",
    name: "The Static Garden",
    shortDescription: `
      A garden filled with fake plants and birdsong on loop.
    `,
    description: tmpl`
      Plastic plants are arranged in neat rows, their bright green leaves unmoving.
      A speaker hidden in the walls plays soft birdsong on a loop, though the audio skips occasionally.
      The ceiling shows a forest canopy with beams of light breaking through, though the light flickers slightly.
    `,
    color: "text-green-400",
    exits: [
      {
        roomId: "room:ill_fitting_lounge",
      },
    ],
  },

  {
    id: "room:quiet_plaza",
    name: "The Quiet Plaza",
    shortDescription: `
      An open seating area with broken fountains.
    `,
    description: tmpl`
      A small plaza with benches and old, non-functional fountains.
      The sound of running water plays softly through hidden speakers, though there’s no visible source.
      The ceiling displays a starry night, but the constellations are scattered and sometimes shift position.
    `,
    color: "text-black-500",
    exits: [
      {
        roomId: "room:feedback_booth",
      },
      {
        roomId: "room:ill_fitting_lounge",
      },
    ],
  },

  {
    id: "room:waiting_room",
    name: "The Waiting Room",
    shortDescription: `
      A dull room with clocks stuck at random times.
    `,
    description: tmpl`
      A simple room with rows of uncomfortable chairs and piles of outdated magazines.
      The clocks on the wall are stuck at random times, and the lights occasionally flicker.
      The sky above is perpetually overcast, with dark clouds that never produce rain.
    `,
    color: "text-gray-700",
    exits: [
      {
        roomId: "room:quiet_plaza",
      },
    ],
  },
];
