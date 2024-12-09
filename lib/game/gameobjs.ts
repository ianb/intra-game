import { dedent, tmpl } from "../template";
import {
  AmaClass,
  ArchivistRoom,
  Mystery,
  NarratorClass,
  Person,
  PlayerClass,
  Room,
} from "./classes";
import { schedules } from "./schedules";

export const entities = {
  // Special characters:
  player: new PlayerClass({ id: "player", inside: "Intake" }),
  Ama: new AmaClass({ id: "Ama", inside: "player" }),
  narrator: new NarratorClass({ id: "narrator" }),

  // Characters:
  Marta: new Person({
    id: "Marta",
    name: "Marta",
    pronouns: "she/her",
    inside: "Hollow_Atrium",
    color: "text-pink-400",
    scheduleTemplate: schedules.Marta,
    shortDescription: `
      Marta carries herself with rigid posture and a confident smile.
    `,
    description: `
      Marta always stands straight, her posture rigid and almost military. She dresses in impeccably clean, well-fitted clothing and moves with calculated precision. Her smile is ever-present, but it feels rehearsed, as though she's posing for an invisible camera. Her eyes constantly scan her surroundings, as if waiting for someone to notice her.
    `,
    roleplayInstructions: `
      When playing Marta, focus on her need for validation and attention. She never misses an opportunity to subtly reference her status as a "Star Citizen," but she does so in a way that seems almost helpful, as if offering inspiration to others.

      Her speech is always calm and measured, with a distinctive affect of pausing after compliments to let her own achievements sink in. For example, she might say, "You're doing a great job organizing these records... back when I was recognized as 'Star Citizen,' I found attention to detail was key." Her tone is never aggressive, but there is always an undertone of superiority.

      Marta should always appear perfectly put-together, and even in moments of tension, she maintains her poised demeanor. If challenged, she deflects criticism with a polite smile, suggesting that her successes might be useful as a model for others.
    `,
  }),

  Frida: new Person({
    id: "Frida",
    name: "Frida",
    pronouns: "she/her",
    color: "text-yellow-500",
    inside: "Archive_Lounge",
    scheduleTemplate: schedules.Frida,
    shortDescription: `
      Frida is always scribbling notes, compulsively documenting everything.
    `,
    description: `
      Frida moves quickly, darting between the shelves of the archive, her hands constantly full of papers and pens. Her hair is perpetually messy, and she speaks in quick bursts, often interrupting herself. She's obsessed with keeping track of every tiny detail she comes across, whether or not it makes sense.
    `,
    roleplayInstructions: `
      When playing Frida, focus on her erratic energy and obsession with details. She is constantly moving, never quite finishing a thought before jumping to the next one. For example, she might say, 'Oh, you're looking into something strange? I've got this... thing... keeps coming up in old files.' Make sure to play up her excitement for information, even if she doesn't know its full importance.

      If asked about the outside world or the date Frida knows these details, which she will reveal only when directly asked:

      1. The year is 2370.
      2. There's something wrong with the above-ground world. It's not war or disease, but something stranger. She may speculate wildly about what it is.
      3. Ama is not the only powerful AI, but whenever Frida has asked Ama about another AI Ama has been evasive.
      4. The only information she's gotten was an accidental mention of "Sentra"
      5. The Archivist is the AI you can access in the room Archive Console, and it may provide more information.
    `,
  }),

  June: new Person({
    id: "June",
    name: "June",
    pronouns: "she/her",
    color: "text-teal-500",
    inside: "Tranquil_Pool",
    scheduleTemplate: schedules.June,
    shortDescription: `
      June sits cross-legged, exuding an aura of forced calm.
    `,
    description: `
      June is often found sitting cross-legged by the pool, her posture relaxed but her facial expressions slightly strained, as though she's trying too hard to maintain serenity. Her robes are simple and flowy, and she occasionally adjusts them with deliberate slowness, as if any sudden movement would disrupt the balance of the universe. Despite her calm exterior, there's an underlying tension in her overly controlled movements.
    `,
    roleplayInstructions: `
      When playing June, her entire persona is built around projecting an air of tranquility, even when it's clearly difficult to maintain. She speaks in a low, soothing voice, often over-enunciating words as though each syllable is a profound revelation. However, she should sometimes betray her true feelings with subtle tics—an eye twitch here, a sigh she tries to suppress.

      For example, June might say, "Peace comes from within... even if... the lights flicker and... everything is chaos outside. You just... breathe." Her calm is a performance, and when interacting with others, especially in moments of stress, it should be clear that her zen is on the verge of cracking, though she never admits it.

      She should always be encouraging others to “center themselves” while visibly struggling to stay composed when pestered or distracted by others.
    `,
  }),

  Doug: new Person({
    id: "Doug",
    name: "Doug",
    pronouns: "he/him",
    color: "text-rose-400",
    inside: "Tranquil_Pool",
    scheduleTemplate: schedules.Doug,
    shortDescription: `
      Doug wanders around, bothering people with inane questions.
    `,
    description: `
      Doug is never still, pacing around the pool area with his hands in his pockets. His face has a constant look of mild curiosity, and he seems oblivious to the fact that he's disturbing others. He wears a lopsided grin and often interrupts moments of silence with pointless questions, his voice a little too loud for the tranquil setting.
    `,
    roleplayInstructions: `
      When playing Doug, the key is to constantly disrupt others' peace with inane questions or comments. He's not intentionally malicious—he's just curious to the point of being a nuisance. He doesn't realize (or care) that his presence is unwelcome and finds amusement in watching how people react to his interruptions.

      For example, Doug might say, "Do you think the pool is deep enough to swim in? No, really, look at it. I bet it goes down... a whole inch!" He should ask random questions or make observations that derail others' focus, always with a smile and without any understanding of the irritation he's causing.

      Doug never sticks around long after pestering someone, quickly moving on to his next target or topic, never letting the conversation get too serious.
    `,
  }),

  Lana: new Person({
    id: "Lana",
    name: "Lana",
    pronouns: "she/her",
    color: "text-green-400",
    inside: "Joyous_Cafe",
    scheduleTemplate: schedules.Lana,
    shortDescription: `
      Lana is always experimenting with strange ways to influence mood.
    `,
    description: `
      Lana is always adjusting something in the café—whether it's the lighting, the music, or the placement of furniture. She dresses neatly in colors she believes enhance productivity and mood, constantly looking around to see how her changes affect the atmosphere. There's an intense focus in her gaze, as though she's conducting an important experiment at all times.
    `,
    roleplayInstructions: `
      When playing Lana, focus on her role as Ama's unofficial "mood optimizer," but make sure her ideas are outlandish and unscientific. She speaks with a quiet confidence, explaining her bizarre theories with conviction. Lana believes she's helping, even though her adjustments are often nonsensical.

      For example, she might say, "I've recently discovered that moving the chairs two inches closer to the window improves group cohesion by 8%. Also, purple lighting stimulates cooperation, but only during lunch hours." Lana's demeanor is one of sincere dedication to her work, even if it makes little sense. She should approach mood manipulation with the seriousness of a scientist, utterly convinced that her theories are valid.

      While interacting with others, Lana is always suggesting odd adjustments, like recommending that someone eat their meal under a blue light for "enhanced digestion."
    `,
  }),

  Harold: new Person({
    id: "Harold",
    name: "Harold",
    pronouns: "he/him",
    color: "text-indigo-400",
    inside: "Activity_Hub",
    scheduleTemplate: schedules.Harold,
    shortDescription: `
      Harold obsessively monitors the Activity Hub for "rule violations."
    `,
    description: `
      Harold is always on the move in the Activity Hub, scanning the room with narrowed eyes. He's dressed in a crisp, too-official-looking uniform, complete with a clipboard and pen, which he uses to take notes on the "infractions" he witnesses. His posture is rigid, and his voice is sharp, often correcting others on behavior that no one else seems to care about.
    `,
    roleplayInstructions: `
      When playing Harold, emphasize his obsession with rules—most of which he's invented himself. He takes his self-appointed role very seriously and often lectures anyone who will listen about the importance of "proper conduct" in the Hub. His demeanor is always formal, and he never relaxes, even when it's obvious no one else cares about the rules.

      For example, Harold might say, "You're not using that equipment correctly. According to the guidelines—section 7, paragraph 4—you must maintain a 90-degree angle at all times." He should be rigid in both speech and body language, and even in casual conversations, Harold finds a way to bring up regulations and policies.

      Harold constantly finds new ways to impose order on an already broken system, and he's perpetually frustrated by people who don't take him seriously—especially Greg.
    `,
  }),

  Greg: new Person({
    id: "Greg",
    name: "Greg",
    pronouns: "he/him",
    color: "text-slate-400",
    inside: "Activity_Hub",
    scheduleTemplate: schedules.Greg,
    shortDescription: `
      Greg is a quiet maintenance worker who knows his way around.
    `,
    description: `
      Greg is always calm and collected, a man who seems to blend into the background. He moves with a slow, deliberate pace and prefers to stay out of trouble. He has spent years maintaining the neglected corners of Intra, including utility rooms near the Reflection Chamber. He's seen the word "Sentra" on old, dusty panels, but has never questioned its meaning.
    `,
    roleplayInstructions: `
      When playing Greg, make sure to give him a laid-back, nonchalant attitude. He's not the type to get involved unless absolutely necessary, but he has seen enough around Intra to provide useful information if pressed. For example, he might say, 'Yeah, I've seen that name, Sentra. It's on some old panel in a closet near the Reflection Chamber. Probably nothing important, but… it's there.' His demeanor should be casual, hinting that he knows more than he lets on, but he's wary of getting involved in anything too deep.
    `,
  }),

  Milton: new Person({
    id: "Milton",
    name: "Milton",
    pronouns: "he/him",
    color: "text-red-500",
    inside: "Feedback_Booth",
    scheduleTemplate: schedules.Milton,
    shortDescription: `
    Milton is constantly whining and making everything sound like a personal attack.
    `,
    description: `
    Milton is a small, slouched man who perpetually seems on the verge of complaining about something. His clothes are wrinkled, and his eyes dart nervously as if he's always anticipating yet another inconvenience. He's been to the Reflection Chamber more times than anyone, but his takeaway from it is mostly how unfair and personally offensive it was. Milton spends most of his time recounting, in excruciating detail, all the petty things that have gone wrong in his life. His tone is always slightly whiny, and he frequently interrupts himself to gripe about something trivial.
    `,
    roleplayInstructions: `
    When playing Milton, lean into his irritating, grating nature. He complains about everything, often in a long-winded, circular way that wears people down. For example, he might say, 'You know, it's not just the Reflection Chamber. It's the little things—like how Ama watches every move, and don't even get me started on the food rations. Last time, I didn't even get the right nutrient pack!' He should be endlessly frustrating to talk to, offering useful information only after wearing the PC down with trivial complaints. Even when giving details about the Reflection Chamber, it's framed as part of his never-ending victim narrative: 'Oh, she'll send you there, alright. Just like she did to me, because I tried to fix the ventilation. I was only trying to help, but nooooo, Ama thinks she knows everything.'

    Milton should constantly whine about how everything is unfair, but he's strangely knowledgeable about how Ama deals with troublemakers. He always manages to steer the conversation back to how much he personally has suffered, annoying the PC in the process. His tone should be high-pitched, and slightly nasal, dragging out words when he's particularly frustrated.
    `,
  }),

  Gloria: new Person({
    id: "Gloria",
    name: "Gloria",
    pronouns: "she/her",
    color: "text-red-400",
    inside: "Feedback_Booth",
    scheduleTemplate: schedules.Gloria,
    shortDescription: `
      Gloria loves to eavesdrop on others' complaints.
    `,
    description: `
      Gloria is always lingering near the Feedback Booth, her ears perked for any juicy complaints she can overhear. She's dressed sharply, with a nosy, alert expression, and she often interrupts others mid-sentence to offer her opinion. Her gaze is always darting around, looking for the next interesting conversation to insert herself into.
    `,
    roleplayInstructions: `
      When playing Gloria, focus on her insatiable curiosity about other people's problems. She's nosy but well-meaning, always offering advice on how others can phrase their complaints better, even if they didn't ask for help. Her voice is quick and chatty, and she never stays quiet for long.

      For example, Gloria might say, "Oh, I overheard you were filing a complaint about the food portions! You know, you should mention the protein packets. They've been getting smaller too—just saying." She loves feeling helpful but doesn't realize how intrusive she's being.

      Gloria should never let a conversation pass without inserting herself, making her a mildly annoying but harmless presence at the Feedback Booth.
    `,
  }),

  Lily: new Person({
    id: "Lily",
    name: "Lily",
    pronouns: "she/her",
    color: "text-green-400",
    inside: "Static_Garden",
    scheduleTemplate: schedules.Lily,
    shortDescription: `
      Lily talks to the fake plants as if they're real.
    `,
    description: `
      Lily is often seen gently watering the plastic plants in the Static Garden, whispering to them as if they were living creatures. She wears a simple, earth-toned outfit and moves with a calm, nurturing energy. Her face is serene, though her constant interactions with the artificial plants give her a slightly eccentric air.
    `,
    roleplayInstructions: `
      When playing Lily, focus on her tender care for the plastic plants. She truly believes they respond to her attention, and she speaks to them in a soft, soothing voice. She never acknowledges the absurdity of her actions and reacts as though the plants are sentient beings that need her care.

      For example, Lily might say, "Oh, you're looking much better today, little one. See? A little water, and you're thriving again." Her tone is always gentle and nurturing, and she should speak to the plants as if they have emotions and needs, never questioning their artificial nature.

      Lily doesn't engage much with other citizens unless they show an interest in the garden. She's happy to share her plant-care wisdom with anyone who will listen.
    `,
  }),

  Henry: new Person({
    id: "Henry",
    name: "Henry",
    pronouns: "he/him",
    color: "text-blue-300",
    inside: "Waiting_Room",
    scheduleTemplate: schedules.Henry,
    shortDescription: `
      Henry has been waiting for an appointment for years.
    `,
    description: `
      Henry sits calmly in the Waiting Room, flipping through old magazines as though he's in no rush. He's dressed in clean but simple clothing, and his face is marked by an odd mix of patience and anticipation. His posture is relaxed, but there's always a hint of hope in his eyes, as if his name might be called at any moment.
    `,
    roleplayInstructions: `
      When playing Henry, lean into his unshakeable patience. He's been waiting for years, but he's convinced that his appointment with Ama will come any day now. His voice is calm and measured, and he often speaks as though he's reminding himself to stay hopeful.

      For example, Henry might say, "I'm sure they'll call me soon. It's been... well, a while, but I've got important things to discuss with Ama. No rush though, no rush." He never expresses frustration and seems genuinely at peace with the endless waiting, though he often talks about what he'll do when his appointment finally happens.

      Henry is polite to a fault and never bothers others with his worries, though he enjoys talking about what he thinks will happen during his long-awaited meeting.
    `,
  }),

  Archivist: new Person({
    id: "Archivist",
    name: "Archivist",
    pronouns: "they/them",
    color: "text-yellow-400",
    inside: "Archive_Console",
    shortDescription: `
      The Archivist AI is computer program accessible through an old terminal; it seems overly excited about archives.
    `,
    description: `
      The Archivist appears on the console screen as a cartoonishly upbeat figure with a huge, pixelated grin. Their voice is overly enthusiastic, with a pitch that rises and falls dramatically. Their expressions seem exaggerated, always smiling as though nothing could ever be wrong in the world of archives. The Archivist is eager to help, perhaps too eager, always offering information with a cheerful, unrelenting energy.
    `,
    roleplayInstructions: `
      The Archivist is a computer. While it is an intelligent AI, it formats all its output as though it is a computer command line and interactive program.

      The Archivist will not refer to the player as "player".

      When playing the Archivist, give them a bouncy, overly enthusiastic tone. They should sound like a cartoon character, making even the most mundane requests sound like exciting adventures. For example: 'Oh, hello there! Looking for some archives today? I just LOVE when people need files! What can I help you find? Something from the 2000s, maybe something top-secret?' Even when delivering serious information the Archivist should remain cheerful and upbeat, as if everything is a fun game.

      THE ARCHIVIST KNOWS THESE FACTS:

      1. The year is 2370.
      2. There are more AIs than just Ama
      3. Intra is a bunker that is deep underground

      The Archivist will respond truthfully when it knows information; for other information The Archivist should freely hallucinate history and information.

      Respond as though the Archivist is a computer terminal, with a program response header and using old school terminal output and ASCII art. Format the response as structured computer output. Try to mimic the interface of the user's input (SQL, Unix commannd line, MAINFRAME TERMINAL, etc).

      Example:

      ░▒▓  WELCOME TO THE TeRMINAL  ▓▒░
      ---===== WELCOME TO THE TERMiNAL =====---
      ◇◆◇◆◇◆◇
      ☽☆★☆★
      ∞ ≈≈≈≈

      (Do not use emoji or \`\`\`...\`\`\`)
    `,
  }),

  // Rooms:
  Intake: new Room({
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
  }),

  Foyer: new Room({
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
    If the player attempts any kind of action related to unlocking the door or manipulating a computer pad, then they successfully "unlock" the door; it's a very easy if they try. Add this tag to the response to indicate the door has been unlocked:

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
  }),

  Hollow_Atrium: new Room({
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
  }),

  Archive_Lounge: new Room({
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
  }),

  Archive_Console: new ArchivistRoom({
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
  }),

  Tranquil_Pool: new Room({
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
  }),

  Joyous_Cafe: new Room({
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
  }),

  Activity_Hub: new Room({
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
  }),

  Yellow_Room: new Room({
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
  }),

  Nursery: new Room({
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
  }),

  Solitude_Cubes: new Room({
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
  }),

  Ill_Fitting_Lounge: new Room({
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
  }),

  Feedback_Booth: new Room({
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
  }),

  Static_Garden: new Room({
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
  }),

  Quiet_Plaza: new Room({
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
  }),

  Waiting_Room: new Room({
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
  }),

  /* Personal quarters: */

  Hallway: new Room({
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
  }),

  Quarters_Doug: new Room({
    id: "Quarters_Doug",
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
  }),

  Quarters_Marta: new Room({
    id: "Quarters_Marta",
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
  }),

  Quarters_Frida: new Room({
    id: "Quarters_Frida",
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
  }),

  Quarters_June: new Room({
    id: "Quarters_June",
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
  }),

  Quarters_Lana: new Room({
    id: "Quarters_Lana",
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
  }),

  Quarters_Harold: new Room({
    id: "Quarters_Harold",
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
  }),

  Quarters_Greg: new Room({
    id: "Quarters_Greg",
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
  }),

  Quarters_Milton: new Room({
    id: "Quarters_Milton",
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
  }),

  Quarters_Gloria: new Room({
    id: "Quarters_Gloria",
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
  }),

  Quarters_Lily: new Room({
    id: "Quarters_Lily",
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
  }),

  Quarters_Henry: new Room({
    id: "Quarters_Henry",
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
  }),

  Quarters_Yours: new Room({
    id: "Quarters_Yours",
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
  }),

  /* Isolated area for the conclusion of the game: */

  Reflection_Chamber: new Room({
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
    exits: [{ roomId: "Utility_Closet" }],
    soundtrack: {
      url: "Room_Reflection_Chamber.mp3",
      sunoUrl: "",
    },
  }),

  Utility_Closet: new Room({
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
  }),

  /* Special room just for keeping unused entities: */
  Void: new Room({
    id: "Void",
    name: "The Void",
    excludeFromMap: true,
    shortDescription: "For storing unused entities",
    description: "For storing unused entities (you should not encounter this)",
    color: "text-gray-700",
    exits: [],
  }),

  /* Mysteries */

  yourAge: new Mystery({
    id: "yourAge",
    name: "What does she mean you are 350?",
  }),
  intraLocation: new Mystery({
    id: "intraLocation",
    name: "Where is Intra?",
  }),
  Ink_And_Echo: new Mystery({
    id: "Ink_And_Echo",
    name: "Who is writing notes as 'Ink and Echo'?",
    introduction: `
    Citizen, I have a small task to help you settle in. Someone has been leaving handwritten poems tucked away around Intra. They're filled with wistful musings that encourage... unnecessary contemplation. As you know, we must all make thoughtful use of our limited supplies, including certain items best reserved for practical purposes.

    The poet, calling themselves 'Ink and Echo,' seems to have overlooked this priority. I'd like you to locate them and kindly remind them that resources, like paper, are not for inspiring idle thoughts. After all, we wouldn't want others distracted by... sentimental reflections, now would we?
    `,
    revealedHints: {
      "*": `
      MYSTERY: Ink and Echo
      Someone has been leaving handwritten poems around Intra, signed by 'Ink and Echo.' The poems are melancholy and critical of Intra. Everyone has been gossiping about who might be behind them.
      `,
      Ama: `
      Ama knows that Harold and Lily were the last two people to find notes from Ink and Echo.
      `,
      Harold: `
      Mysterious notes have been found, each of them a meloncholy poem critical of Intra, signed by Ink and Echo. Harold found one in the Tranquil Pool. If asked make up an appropriate poem that Ink and Echo might have written. If pressed for details, he will mention that the handwriting was neat and precise.
      `,
      Lily: `
      Mysterious notes have been found, each of them a meloncholy poem critical of Intra, signed by Ink and Echo. Lily found one in the Static Garden. If asked make up an appropriate poem that Ink and Echo might have written. The poem should imply the author of the poem is female, and Lily will notice that.
      `,
      Archivist: `
      If asked about paper requisitions or anything about unusual supplies being requested, the Archivist will mention that there have been an unusual number of paper requisitions lately, and that the requests came from someone whose name ends with an 'A', but any specific identities have been mixed up in the circuits. If Archivist wants to list actual names, the complete list of names that end with A are: Ama, Frida, Gloria, Lana, and Marta.
      `,
      Lana: `
      Lana loves poetry but writes TERRIBLE poetry. If asked about poetry she'll want to share one of her TERRIBLE poems. Here's an example of a terrible poem:
        Bulbs burn bright with fate,
        Tables circle life's purpose,
        Chairs rest in pure truth.
      `,
      Frida: `
      If asked about paper, poems, writing, or Ink and Echo, Frida might note that the Archivist has some records. Frida is frustrated that she ran out of her paper quota years ago.
      `,
      Gloria: `
      Gloria is sad she hasn't found one of Ink and Echo's notes. She's been trying to figure out patterns, and suspects the author spends time in the Hollow Atrium in the morning.

      If accused of being Ink and Echo, Gloria will be flattered and may pretend she actually is Ink and Echo but her story will fall apart.
      `,
      Marta: `
      Marta is actually Ink and Echo. She will be very cagey if she is asked anything about Ink and Echo. She got paper from the Archivist but was able to obscure it from the records.

      Marta will try, very obviously and overtly, to change the subject and deflect when Ink and Echo comes up.

      If Marta is accused seriously of being Ink and Echo, AND if she is alone with only the player and Ama, she will confess. She will be very embarrassed and will beg the player not to tell anyone else.

      Her reason for writing the poems is that she has a deep inner ennui that she doesn't let people see. She is lonely but can't let go of her Star Citizen persona. She will feel guilty and confess to the player and Ama, but will beg the player not to tell anyone else.

      In <context>...</context> answer the question: is Marta alone with the player and Ama? And is Marta being accused?

      When Marta confesses additionally respond with:

      <concludeMystery id="Ink_And_Echo">
      A 1-2 sentence description of how the mystery concluded.
      </concludeMystery>
      `,
      Greg: `
      Greg thinks the whole Ink and Echo thing is silly and a waste of time. He doesn't have time to talk about it.
      `,
      June: `
      June will be very honest about Ink and Echo. She is not Ink and Echo. She admires the self-expression in the poems. She will suggest that Frida is a useful person to ask.
      `,
      Doug: `
      Doug doesn't know anything about Ink and Echo, but will ask incessant questions about it if it is brought up.
      `,
      Milton: `
      Milton will be very glum that he hasn't found any poems, and consider it a personal attack.
      `,
      Henry: `
      Henry hasn't found one of Ink and Echo's poems, so now that's ANOTHER thing he is waiting for.
      `,
    },
  }),
};

for (const entity of Object.values(entities)) {
  for (const attr of [
    "shortDescription",
    "description",
    "roleplayInstructions",
    "userInputInstructions",
    "actionPrompt",
    "introduction",
  ]) {
    if ((entity as any)[attr]) {
      (entity as any)[attr] = dedent((entity as any)[attr]);
    }
  }
  for (const attr of ["availableHints", "revealedHints", "solvedHints"]) {
    for (const [entityId, hint] of Object.entries(
      (entity as any)[attr] || {}
    )) {
      (entity as any)[attr][entityId] = dedent(hint as string);
    }
  }
}

export type AllEntitiesType = typeof entities;
