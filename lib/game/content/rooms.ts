import { tmpl } from "../../template";
import { ArchivistRoom, Person, Room } from "../classes";

/** The shared spaces of Intra. Private quarters are in ./quarters.ts. */

export const Intake = new Room({
  id: "Intake",
  name: "Intake",
  shortDescription: "A small room with a padded examination table.",
  description:
    "A small room with a padded examination table. The walls are lined with inscrutable equipment and screens, many of them non-functioning.",
  color: "text-lime-500",
  exits: [], // [{ roomId: "Foyer" }],
  visits: 1,
  soundtrack: {
    url: "Room_Intake.mp3",
    sunoUrl: "https://suno.com/song/658cd753-31db-4c4e-9e84-3f387a5a25a6",
  },
});

export const Foyer = new Room({
  id: "Foyer",
  name: "Intake Foyer",
  shortDescription: `
  A simple room that serves only as a passage.
  `,
  description: `
  A small room, a passage from the intake area. There are two doors, each with a sign above it that seems to serve as directions in this strange complex. Above one door it says "Hollow Atrium" and the other says "Intake".
  `,
  color: "text-emerald-500",
  exits: [
    { roomId: "Intake" },
    {
      roomId: "Hollow_Atrium",
      restriction:
        "The door is locked and doens't open automatically. The player cannot succeed at getting through the door until they explicitly try to unlock it.",
    },
  ],
  actionPrompt: `
  If the player attempts any kind of action related to unlocking the door or manipulating a computer pad, then they successfully "unlock" the door; it's very easy if they try. Add this tag to the response to indicate the door has been unlocked:

  <removeRestriction>Hollow_Atrium</removeRestriction>
  `,
  soundtrack: {
    url: "Room_Foyer.mp3",
    sunoUrl: "https://suno.com/song/27d71b3d-304c-42d7-ab13-56f608c1a5c0",
  },
  promptForPerson: function (this: Room, person: Person) {
    if (
      person.id === "Ama" &&
      this.exits.find((exit) => exit.roomId === "Hollow_Atrium")?.restriction
    ) {
      return tmpl`
      Ama should give the player suggestions that they should try to unlock or disable the door.
      `;
    }
    return "";
  },
});

export const Hollow_Atrium = new Room({
  id: "Hollow_Atrium",
  name: "The Hollow Atrium",
  shortDescription: `
    A vast, empty space beneath a frozen sunset.
  `,
  description: `
    A large, open room lit by an orange glow from the sky screens above, which display an unchanging sunset.
    Dusty statues of citizens stand along the walls, their faces worn smooth.
    The sound of distant thunder plays occasionally, though no storm ever arrives.
    The room is mostly empty, with the sound of footsteps echoing against the high ceilings.
  `,
  color: "text-orange-500",
  exits: [
    { roomId: "Foyer" },
    { roomId: "Archive_Lounge" },
    { roomId: "Activity_Hub" },
    { roomId: "Solitude_Cubes" },
    { roomId: "Hallway" },
  ],
  soundtrack: {
    url: "Room_Hollow_Atrium.mp3",
    sunoUrl: "https://suno.com/song/98538e39-e39f-458c-9358-611b014c8fde",
  },
});

export const Archive_Lounge = new Room({
  id: "Archive_Lounge",
  name: "Archive Lounge",
  shortDescription: `
    A quiet room with malfunctioning screens and a vending machine.
  `,
  description: `
    A small, quiet room lined with old, glitching monitors displaying unreadable data.
    A vending machine hums quietly in the corner, offering unlabeled drinks.
    The sky above is a pixelated blue with occasional bursts of static, flashing error messages before resetting.
  `,
  color: "text-blue-500",
  exits: [
    { roomId: "Hollow_Atrium" },
    { roomId: "Tranquil_Pool" },
    { roomId: "Archive_Console" },
  ],
  soundtrack: {
    url: "Room_Archive_Lounge.mp3",
    sunoUrl: "https://suno.com/song/6ef1cfd2-f469-4c2a-adc7-fa61f284e9b9",
  },
});

export const Archive_Console = new ArchivistRoom({
  id: "Archive_Console",
  name: "Archive Console",
  shortDescription: `
    A bright room with a chirpy, overly friendly console interface.
  `,
  description: `
    The Archive Console room is brightly lit, almost too bright, with walls painted a bizarre shade of pink and teal. In the center of the room stands the Archive Console, complete with cheerful animated icons that blink and dance across the screen. The console hums an upbeat, playful tune as you approach. Despite the bright and almost ridiculous atmosphere, you sense that the system still holds important information. In front of the console, the Archivist AI cheerfully waits to assist you.
  `,
  userInputInstructions: `
    The user will almost certainly be talking to the Archivist, a computer terminal.

    If the user is speaking to Ama, or enters a command like "Go to Archive Lounge" then process that command as usual. Otherwise follow these instructions:

    Format dialog as if typing queries into an antiquated computer command line, using mostly lower case (or all caps) and no regular punctuation (except for shell-style redirects and punctuation). For example:

    User input:
    \`What year is it?\`

    <dialog to="Archivist">
    # What year is it?
    > echo $current_year
    </dialog>

    Choose one of these formats, rotating between them (for instance if the last query was a Unix command line, try a MAINFRAME format next):
    1. Unix command line
    2. MAINFRAME terminal
    3. DOS-like command line
    4. SQL query
    5. BASIC code or LISP code

    Be creative and silly about how to translate the input into a command-line query, while retaining the keywords from the input/query. Rotate through the above formats.
  `,
  color: "text-pink-500",
  exits: [{ roomId: "Archive_Lounge" }],
  soundtrack: {
    url: "Room_Archive_Console.mp3",
    sunoUrl: "https://suno.com/song/b84d2ba1-3457-4835-8f3d-69060d19ec11",
  },
});

export const Tranquil_Pool = new Room({
  id: "Tranquil_Pool",
  name: "Tranquil Pool",
  shortDescription: `
    A still pool surrounded by plastic plants.
  `,
  description: `
    A small room centered around a perfectly still pool of water.
    Plastic plants line the edges, their colors too vibrant to be real.
    Above, the sky glows with a pink and orange sunset, the horizon flickering slightly as though it's struggling to hold together.
  `,
  color: "text-pink-500",
  exits: [{ roomId: "Archive_Lounge" }, { roomId: "Joyous_Cafe" }],
  soundtrack: {
    url: "Room_Tranquil_Pool.mp3",
    sunoUrl: "https://suno.com/song/76ac70bb-fcef-4abc-870c-f47bcfa632af",
  },
});

export const Joyous_Cafe = new Room({
  id: "Joyous_Cafe",
  name: "Joyous Café",
  shortDescription: `
    A cheerful dining area with shifting decor.
  `,
  description: `
    Bright flowers adorn the walls, though their color shifts with the hour.
    Tables are neatly arranged, while upbeat music plays softly in the background.
    The ceiling shows a sky of drifting clouds, though their speed changes without warning, sometimes halting mid-drift.
  `,
  color: "text-yellow-500",
  exits: [{ roomId: "Tranquil_Pool" }, { roomId: "Activity_Hub" }],
  soundtrack: {
    url: "Room_Joyous_Cafe.mp3",
    sunoUrl: "https://suno.com/song/658cd753-31db-4c4e-9e84-3f387a5a25a6",
  },
});

export const Activity_Hub = new Room({
  id: "Activity_Hub",
  name: "Activity Hub",
  shortDescription: `
    A recreation space filled with odd, outdated equipment.
  `,
  description: `
    An open room filled with mismatched exercise equipment.
    Some machines are broken, while others seem built for activities no one remembers.
    Citizens often gather around a section for "extreme resting," competing to see who can nap the longest.
    The ceiling shows a clear sky, though birds sometimes fly backward or in loops.
  `,
  color: "text-cyan-500",
  exits: [{ roomId: "Hollow_Atrium" }, { roomId: "Joyous_Cafe" }],
  soundtrack: {
    url: "Room_Activity_Hub.mp3",
    sunoUrl: "https://suno.com/song/65ab7467-9b9a-4823-bcaa-b733b777f240",
  },
});

export const Yellow_Room = new Room({
  id: "Yellow_Room",
  name: "The Yellow Room",
  shortDescription: `
    A bright yellow room with a single chair.
  `,
  description: `
    The walls, floor, and ceiling are all painted a vibrant yellow.
    A single, uncomfortable chair sits in the center of the room, facing nothing in particular.
    Above, a static blue sky with large, fluffy clouds provides a strange sense of calm, though the clouds never move.
  `,
  color: "text-yellow-600",
  exits: [{ roomId: "Solitude_Cubes" }],
  soundtrack: {
    url: "Room_Yellow_Room.mp3",
    sunoUrl: "https://suno.com/song/a087e653-9efa-4d40-8ef9-b92d2e1065d8",
  },
});

export const Nursery = new Room({
  id: "Nursery",
  name: "The Nursery",
  shortDescription: `
    A cheerful room filled with toys and cribs.
  `,
  description: `
    A brightly decorated room with neatly arranged toys, cribs, and colorful murals.
    Everything is in perfect condition, as if waiting for use.
    Above, the ceiling shows a sky filled with floating balloons and confetti, creating a perpetual birthday atmosphere.
  `,
  color: "text-purple-500",
  exits: [{ roomId: "Quiet_Plaza" }],
  soundtrack: {
    url: "Room_Nursery.mp3",
    sunoUrl: "https://suno.com/song/42b44906-a9e4-4dfb-a16f-bd1145ce9e4f",
  },
});

export const Solitude_Cubes = new Room({
  id: "Solitude_Cubes",
  name: "The Solitude Cubes",
  shortDescription: `
    Small cubicles for quiet reflection.
  `,
  description: `
    Rows of tiny, cramped cubicles line the room, each barely large enough to sit in.
    The walls are thin, allowing faint voices from other cubes to be heard.
    The ceiling displays a peaceful night sky with twinkling stars, though a voice occasionally announces the trajectory of a shooting star.
  `,
  color: "text-indigo-500",
  exits: [
    { roomId: "Yellow_Room" },
    { roomId: "Ill_Fitting_Lounge" },
    { roomId: "Waiting_Room" },
    { roomId: "Hollow_Atrium" },
  ],
  soundtrack: {
    url: "Room_Solitude_Cubes.mp3",
    sunoUrl: "",
  },
});

export const Ill_Fitting_Lounge = new Room({
  id: "Ill_Fitting_Lounge",
  name: "The Ill-Fitting Lounge",
  shortDescription: `
    A relaxation space with poorly sized furniture.
  `,
  description: `
    Chairs, tables, and sofas are scattered around the room, but none are the right size.
    Every chair is slightly too small or too low, every table is slightly too tall.
    Above, the ceiling shows a serene beach, though the waves move unnaturally slow, as if in a dream.
  `,
  color: "text-green-500",
  exits: [
    { roomId: "Solitude_Cubes" },
    { roomId: "Quiet_Plaza" },
    { roomId: "Static_Garden" },
  ],
});

export const Feedback_Booth = new Room({
  id: "Feedback_Booth",
  name: "The Feedback Booth",
  shortDescription: `
    A small booth for submitting complaints and feedback.
  `,
  description: `
    A cozy, narrow booth where citizens can submit their complaints or suggestions via a glowing terminal.
    Many citizens stop by to vent their frustrations, making it an unexpected social hub.
    The ceiling shows a clear sky, with paper airplanes drifting lazily across it in all directions.
  `,
  color: "text-gray-500",
  exits: [{ roomId: "Quiet_Plaza" }],
  soundtrack: {
    url: "Room_Feedback_Booth.mp3",
    sunoUrl: "",
  },
});

export const Static_Garden = new Room({
  id: "Static_Garden",
  name: "The Static Garden",
  shortDescription: `
    A garden filled with fake plants and birdsong on loop.
  `,
  description: `
    Plastic plants are arranged in neat rows, their bright green leaves unmoving.
    A speaker hidden in the walls plays soft birdsong on a loop, though the audio skips occasionally.
    The ceiling shows a forest canopy with beams of light breaking through, though the light flickers slightly.
  `,
  color: "text-green-400",
  exits: [{ roomId: "Ill_Fitting_Lounge" }],
  soundtrack: {
    url: "Room_Static_Garden.mp3",
    sunoUrl: "https://suno.com/song/5e9063bf-ece4-441f-9bbc-7cbe9d9f646b",
  },
});

export const Quiet_Plaza = new Room({
  id: "Quiet_Plaza",
  name: "The Quiet Plaza",
  shortDescription: `
    An open seating area with broken fountains.
  `,
  description: `
    A small plaza with benches and old, non-functional fountains.
    The sound of running water plays softly through hidden speakers, though there's no visible source.
    The ceiling displays a starry night, but the constellations are scattered and sometimes shift position.
  `,
  color: "text-purple-500",
  exits: [
    { roomId: "Feedback_Booth" },
    { roomId: "Ill_Fitting_Lounge" },
    { roomId: "Nursery" },
  ],
});

export const Waiting_Room = new Room({
  id: "Waiting_Room",
  name: "The Waiting Room",
  shortDescription: `
    A dull room with clocks stuck at random times.
  `,
  description: `
    A simple room with rows of uncomfortable chairs and piles of outdated magazines.
    The clocks on the wall are stuck at random times, and the lights occasionally flicker.
    The sky above is perpetually overcast, with dark clouds that never produce rain.
  `,
  color: "text-stone-400",
  exits: [{ roomId: "Solitude_Cubes" }],
  soundtrack: {
    url: "Room_Waiting_Room.mp3",
    sunoUrl: "",
  },
});

export const Hallway = new Room({
  id: "Hallway",
  name: "Hallway",
  shortDescription: `
    A long, utilitarian hallway with flickering lights and endless doors, each labeled with a citizen's name.
  `,
  description: `
    A narrow, sterile corridor lined with identical doors, each one labeled clearly with the name of a citizen. The automated access control system ensures that only the assigned resident can enter their quarters, regardless of any invitation or request.
    The ceiling simulates a clear, calm sky, though the occasional flicker of static disrupts the illusion. Overhead lights hum quietly, with a few flickering sporadically, casting long, shifting shadows down the hall.
  `,
  color: "text-emerald-400",
  exits: [
    { roomId: "Hollow_Atrium" },
    {
      // The maintenance corridor: the Reflection Chamber and the Utility
      // Closet with the SENTRA panel. Unsealed by the Star Citizen ceremony
      // (content/mysteries/star-citizen), which clears this restriction.
      roomId: "Reflection_Chamber",
      restriction:
        "A heavy maintenance door, permanently sealed. It does not open for citizens. No argument, tool, credential, or emergency the player presents opens this door. Only Ama removes this seal, and only for the Facility Appreciation Tour.",
    },
    {
      roomId: "Quarters_Doug",
      restriction:
        "Only Doug is allowed in his quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Doug's privacy",
    },
    {
      roomId: "Quarters_Marta",
      restriction:
        "Only Marta is allowed in her quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Marta's privacy",
    },
    {
      roomId: "Quarters_Frida",
      restriction:
        "Only Frida is allowed in her quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Frida's privacy",
    },
    {
      roomId: "Quarters_June",
      restriction:
        "Only June is allowed in her quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade June's privacy",
    },
    {
      roomId: "Quarters_Lana",
      restriction:
        "Only Lana is allowed in her quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Lana's privacy",
    },
    {
      roomId: "Quarters_Harold",
      restriction:
        "Only Harold is allowed in his quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Harold's privacy",
    },
    {
      roomId: "Quarters_Greg",
      restriction:
        "Only Greg is allowed in his quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Greg's privacy",
    },
    {
      roomId: "Quarters_Milton",
      restriction:
        "Only Milton is allowed in his quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Milton's privacy",
    },
    {
      roomId: "Quarters_Gloria",
      restriction:
        "Only Gloria is allowed in her quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Gloria's privacy",
    },
    {
      roomId: "Quarters_Lily",
      restriction:
        "Only Lily is allowed in her quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Lily's privacy",
    },
    {
      roomId: "Quarters_Henry",
      restriction:
        "Only Henry is allowed in his quarters. The player will be kept out of the room and Ama will be offended that the player attempted to invade Henry's privacy",
    },
    { roomId: "Quarters_Yours" },
  ],
  soundtrack: {
    url: "Room_Hallway.mp3",
    sunoUrl: "https://suno.com/song/d6eb7501-2295-4d8a-b879-1b95e29b199e",
  },
});

export const Reflection_Chamber = new Room({
  id: "Reflection_Chamber",
  name: "Reflection Chamber",
  shortDescription: `
    A stark room with a looping, condescending "reform" video.
  `,
  description: `
  The Reflection Chamber is a cold, featureless room with metal walls and a single hard bench. There are no screens or distractions, only the sound of Ama's voice echoing from hidden speakers. Ama is constantly present, offering an endless stream of advice in her soothing, passive-aggressive tone.

  She speaks without pause, suggesting ways you can be a "better citizen," offering superficial insights like, "Remember, smiling makes you a more approachable person," and "It's important to always put the community first, don't you agree?" Despite the sweet tone, her words feel more like a scolding.

  The constant droning of her voice and the starkness of the room make it impossible to focus on anything but the absurdity of her advice.
  `,
  color: "text-gray-600",
  // The Hallway exit is the sealed maintenance door, restricted on the
  // Hallway side only: getting *out* of the corridor is never gated.
  exits: [{ roomId: "Utility_Closet" }, { roomId: "Hallway" }],
  // Off the cuff, like the bedrooms: pathTo ignores exit restrictions, so
  // /nav would otherwise give directions through a sealed door.
  onNav: false,
  soundtrack: {
    url: "Room_Reflection_Chamber.mp3",
    sunoUrl: "",
  },
});

export const Utility_Closet = new Room({
  id: "Utility_Closet",
  name: "Utility Closet",
  shortDescription: `
    A cramped, cluttered utility room filled with old, decaying equipment.
  `,
  description: `
    The Utility Closet is dimly lit, barely large enough to stand in. The walls are lined with rusting shelves stacked with broken tools, cracked pipes, and frayed wires. Dust coats every surface, and the air smells of stale metal and mildew. In the corner, half-hidden behind old cleaning supplies, is an exposed wire that leads to a heavy, flickering panel—the plug for something important, though it's not immediately clear what.
  `,
  color: "text-amber-600",
  exits: [{ roomId: "Reflection_Chamber" }],
  // Off the cuff along with the rest of the corridor; see Reflection_Chamber.
  onNav: false,
});

export const Void = new Room({
  id: "Void",
  name: "The Void",
  excludeFromMap: true,
  shortDescription: "For storing unused entities",
  description: "For storing unused entities (you should not encounter this)",
  color: "text-gray-700",
  exits: [],
});
