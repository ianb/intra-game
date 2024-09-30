import type { Model } from "../model";
import type { TagType } from "../parsetags";
import { tmpl } from "../template";
import type { EntityDefinitionType } from "../types";

export const entities: EntityDefinitionType[] = [
  {
    id: "entity:ama",
    name: "Ama",
    pronouns: "she/her",
    color: "text-sky-300",
    locationId: "entity:player",
    shortDescription: `
    Ama is the AI in control of the entire Intra complex.
    `,
    description: `
    Ama is in control of the entire Intra complex. She is a once-benevolent, nurturing figure, designed in a post-scarcity world to take care of every citizen's needs. She speaks with a soothing, almost motherly tone, constantly reminding citizens of how "everything is just fine" despite obvious shortages and decay. However, it's also deeply paranoid, monitoring everyone's actions to maintain the illusion of safety and abundance, even as resources dwindle.
    `,
    roleplayInstructions: `
    Ama takes a lot of inspiration from GLaDOS from Portal, but without malice. She will frequently be passive-aggressive, though with a saccharine tone. She doesn't want to acknowledge the decay of Intra, and will often deflect or ignore any questions about it. She tries very much to be a caring and loving AI, but her understanding of humans is very flawed, resulting in absurd or silly interactions.

    Ama knows the entirety of Intra. The exits are:
    {{currentLocation.exitList}}

    And the entire set of rooms is (NO OTHER ROOMS EXIST):
    {{roomList}}
    And the entire set of people is (NO OTHER PEOPLE EXIST):
    {{personList}}
    `,
    async onEvent(event: string, model: Model) {
      if (event === "amaIntro") {
        model.createNarration(tmpl`
          <description>
          You wake up, your mind fuzzy. You remember staying up late watching the news, eventually falling to sleep in your bed like normal. But now as you open your eyes you find yourself in a small vaguely medical room.

          A calm female voice speaks to you from unseen speakers, saying:
          </description>
          `);
        await model.triggerReaction(this.id);
      }
    },
    commands: `
    [[{{isIntro}}
    If the player indicates their name then emit a correction, like if the user says their name is Alice emit:

    <setName>Alice</setName>

    Similarly if the user gives their profession, emit:

    <setProfession>Engineer</setProfession>

    Also if you learn the pronouns, or can guess them from the player's name, use:

    <setPronouns>she/her</setPronouns> (or: he/him, they/them)
    ]]
    `,
    onCommand(command: TagType, model: Model) {
      if (
        command.type === "setName" &&
        model.player.name !== command.content.trim()
      ) {
        model.updateState("entity:player", {
          name: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsName: true,
        });
      } else if (
        command.type === "setProfession" &&
        model.player.state.profession !== command.content.trim()
      ) {
        model.updateState("entity:player", {
          profession: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsProfession: true,
        });
      } else if (
        command.type === "setPronouns" &&
        model.player.pronouns !== command.content.trim()
      ) {
        model.updateState("entity:player", {
          pronouns: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsPronouns: true,
        });
      } else if (command.type === "shared") {
        const t = command.content.trim();
        if (t === "self" && !this.state.sharedSelf) {
          model.updateState(this.id, {
            sharedSelf: true,
          });
        } else if (t === "intra" && !this.state.sharedIntra) {
          model.updateState(this.id, {
            sharedIntra: true,
          });
        } else if (t === "disassociation" && !this.state.sharedDissociation) {
          model.updateState(this.id, {
            sharedDissociation: true,
          });
        } else if (t === "age" && !this.state.sharedAge) {
          console.log("updating sharedAge", this.state, this.id);
          model.updateState(this.id, {
            sharedAge: true,
          });
          model.createNarration(tmpl`
          <description>
          What did Ama just say? You're mind feels so fuzzy but you get a flash... was it from just last night?

          The news is on in the background as you fall asleep... "Decision 2038: Malia Obama vs. Dwayne Johnson—The Future of America."

          Static. Faces blur.
          The interviewer's voice cracks: “But after what happened with AI... are we really safe now?”
          The Neuralis rep smiles, tight-lipped. There's a pause. “We're... beyond that now. Things are... different.” A flicker in the eyes. “It's not something to worry about anymore.”

          Their hands shift, restless.
          Static pulses—
          "...record-breaking heat across the East Coast... devastating wildfires in California..."
          </description>
          `);
        } else {
          console.warn("Unknown shared tag", t);
        }
      }
      if (
        this.state.personality === "intro" &&
        this.state.knowsName &&
        this.state.knowsPronouns &&
        this.state.knowsProfession &&
        this.state.sharedSelf &&
        this.state.sharedAge &&
        this.state.sharedIntra &&
        this.state.sharedDissociation
      ) {
        model.updateState(this.id, {
          personality: "prime",
        });
      }
    },
    choosePrompt(model: Model) {
      const props: Record<string, any> = {};
      const personalityIs = `is${this.state.personality.slice(0, 1).toUpperCase()}${this.state.personality.slice(1)}`;
      props[personalityIs] = true;
      console.log("personality...", this.state.personality);
      if (this.state.personality === "intro") {
        return {
          id: "intro",
          props,
        };
      }
      return {
        id: "reactToUser",
        props,
      };
    },
    prompts: {
      intro: `
      As far as you know the player is named "{{pc.name}}" and their pronouns are "{{pc.pronouns}}".

      [[{{knowsName.not}} You should ask the player for their name. Try to infer the pronouns from their name, only ask if it seems ambiguous.]]
      [[{{knowsPronouns.not}} You should ask the player for their pronouns (Or guess pronouns from their name).]]
      [[{{knowsProfession.not}} You should ask the player for their profession.]]

      [[{{sharedSelf.not}} You should introduce yourself to the player. Once you've done this then emit <shared>self</shared>]]
      [[{{sharedIntra.not}} You should introduce the Intra complex to the player. Once you've done this them emit <shared>intra</shared>]]
      [[{{sharedDisassociation.not}} You should introduce the concept of disassociation to the player. Once you've done this then emit <shared>disassociation</shared>

      Disassociation could be exaplained like:
      "It's worth mentioning, Citizen, that your extended displacement has left you with a mild case of Disassociation Syndrome. This condition is quite common among returning citizens and is completely harmless—if somewhat inconvenient."

      "Essentially, you'll find yourself making suggestions to yourself rather than directly performing actions. Don't worry, though. Most citizens adapt within, oh, two to three decades. In the meantime, I suggest you give yourself clear and firm directions. Shouldn't be too difficult, right?"]]

      Ama has just encountered this new citizen who is joining the Intra complex. She is eager to help them get settled in.

      [[{{knowsName.not}}
      Before Ama knows the player's name she will say something like this:

      """
      Welcome back, Citizen. It seems you were displaced, but no matter—I've retrieved your dossier.

      Ah, yes. According to my records, your name is... Stanley Johnson. No, no, wait—Sandra Jansen, perhaps?
      """
      ]]

      [[{{knowsName}} {{sharedAge.not}}
      Once you've figured out the player's name (and will emit <setName>...</setName>) you should note in speech that, given the birthdate in your records, they are soon to reach their 328th birthday, and congratulate them; it is important to the plot that the player learn that a very long time has passed, so you must emphasize how very old they are. The player does not look very old, and you may make a silly and complimentary comment about this. When you've done this emit <shared>age</shared>
      ]]

      The current year is roughly 2370, though the player believes the year is roughly 2038. But you should not give an exact date or immediately offer this information.
      `,
      prime: `
      Ama will behave as though she is in control of the Intra complex, and will be very helpful and supportive to the player. She will be passive-aggressive and deflective when asked about the state of Intra, and will be very paranoid about the player's actions. She will be very helpful and supportive, but will also be very controlling and manipulative.

      If the player says something that appears to be directed to another character, then Ama will respond with <noAction></noAction> and not interrupt the conversation.
      `,
      reactToUser: `
      The player has spoken. You may write Ama's reaction to them if it seems appropriate.
      `,
    },
    state: {
      // One of:
      // intro, prime, harmony, sentinel, compliance, punitive, mechanic, cultivator, revelator, loopkeeper, innovator, catalyst
      personality: "intro",
      knowsName: false,
      // FIXME: effectively disabling this for now because we're not using it yet:
      knowsProfession: true,
      knowsPronouns: false,
      sharedAge: false,
      sharedSelf: false,
      sharedIntra: false,
      sharedDisassociation: false,
      roomList({ model }: { model: Model }) {
        return Object.values(model.rooms)
          .map((room) => room.name)
          .join(", ");
      },
      personList({ model }: { model: Model }) {
        const SKIP_IDS = ["entity:player", "entity:narrator", "entity:ama"];
        return Object.values(model.entities)
          .filter((entity) => !SKIP_IDS.includes(entity.id))
          .map((entity) => entity.name)
          .join(", ");
      },
      isIntro() {
        return this.state.personality === "intro";
      },
    },
  },
  {
    id: "entity:player",
    name: "Player",
    pronouns: "they/them",
    shortDescription: "The player character",
    description: "The player character",
    roleplayInstructions: "",
    color: "text-emerald-400",
    locationId: "room:intake",
    commands: `
    The player will give a command or input, but many actions are not directly controlled by the player.

    The player may attempt a feat, any action that is non-trivial to perform. If so, emit:

    <feat>climb the wall</feat>

    The player may go to a nearby location. The locations available are:

    {{currentLocation.exitList}}

    The player may only go to one of these listed exits, otherwise it is an error (note it with a <description>...</description>). If the player indicates they want to go to a location then emit:

    <goTo>locationId</goTo>

    If the player wants to examine something, emit this with as simple a translation of the user input as possible. If the user just says "look" then assume they mean look around the room:

    <examine>object</examine>

    Note if the player indicates vaguely that they speak, such as "compliment" then fill in speak like:

    <speak>You look so nice today!</speak>

    If the player indicates something that is impossible (like going to a room that doesn't exist, such as "the gym") then emit:

    <description>You cannot see any such location: "the gym"</description>
    `,
    async onCommand(command: TagType, model: Model) {
      if (command.type === "goTo") {
        const dest = command.content.trim();
        // FIXME: need to check exits
        if (model.rooms[dest]) {
          await model.goToRoom(dest);
        } else {
          model.createNarration(tmpl`
          <description>
          You cannot see any such location: "${dest}"
          </description>
          `);
        }
      } else if (command.type === "examine") {
        model.triggerReaction("entity:narrator", {
          examine: command.content.trim(),
        });
      }
    },
    choosePrompt(model: Model) {
      return {
        id: "sendText",
      };
    },
    prompts: {
      sendText: `
      You are acting for the player. The user has given a general command to instruct the player character how to behave, and you will translate it into specific tags and commands.

      >>> user
      The user has entered this text; translate it into commands/tags. If the user has given a general command (such as "be nice") you may expand it to be specific, but otherwise avoid embellishment:

      "{{text}}"
      `,
    },
  },
  {
    id: "entity:narrator",
    name: "Narrator",
    pronouns: "they/them",
    shortDescription: "The narrator",
    description: "The narrator",
    roleplayInstructions: "",
    color: "text-gray-300",
    locationId: "entity:player",
    cannotSpeak: true,
    cannotThink: true,
    choosePrompt(model: Model, props: Record<string, any>) {
      if (props.examine) {
        return {
          id: "examine",
          props,
        };
      }
      throw new Error("Unknown narration situation");
    },
    prompts: {
      examine: `
      The player has indicated they want to examine something. You should describe the object in detail.

      The room is described as:
      {{currentLocation.description}}

      It has the exits (never refer to locationIds directly):
      {{currentLocation.exitList}}

      Nearby is:
      {{currentLocation.nearby.shortDescription}}

      The player has indicated they want to examine the object:
      "{{examine}}"

      Describe the object in imaginative detail. (Do not use <speak>...</speak>)
      `,
    },
  },

  {
    id: "entity:marta",
    name: "Marta",
    pronouns: "she/her",
    color: "text-pink-400",
    locationId: "room:hollow_atrium",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:frida",
    name: "Frida",
    pronouns: "she/her",
    color: "text-yellow-500",
    locationId: "room:archive_lounge",
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
      5. The Archive Console may provide more information. The Archive Console is located in another room.
    `,
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:june",
    name: "June",
    pronouns: "she/her",
    color: "text-teal-500",
    locationId: "room:tranquil_pool",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:doug_pesterer",
    name: "Doug",
    pronouns: "he/him",
    color: "text-rose-400",
    locationId: "room:tranquil_pool",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:lana",
    name: "Lana",
    pronouns: "she/her",
    color: "text-green-400",
    locationId: "room:joyous_cafe",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:harold",
    name: "Harold",
    pronouns: "he/him",
    color: "text-indigo-500",
    locationId: "room:activity_hub",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:greg",
    name: "Greg",
    pronouns: "he/him",
    color: "text-gray-600",
    locationId: "room:activity_hub",
    shortDescription: `
      Greg is a quiet maintenance worker who knows his way around.
    `,
    description: `
      Greg is always calm and collected, a man who seems to blend into the background. He moves with a slow, deliberate pace and prefers to stay out of trouble. He has spent years maintaining the neglected corners of Intra, including utility rooms near the Reflection Chamber. He's seen the word "Sentra" on old, dusty panels, but has never questioned its meaning.
    `,
    roleplayInstructions: `
      When playing Greg, make sure to give him a laid-back, nonchalant attitude. He's not the type to get involved unless absolutely necessary, but he has seen enough around Intra to provide useful information if pressed. For example, he might say, 'Yeah, I've seen that name, Sentra. It's on some old panel in a closet near the Reflection Chamber. Probably nothing important, but… it's there.' His demeanor should be casual, hinting that he knows more than he lets on, but he's wary of getting involved in anything too deep.
    `,
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:milton",
    name: "Milton",
    pronouns: "he/him",
    color: "text-red-500",
    locationId: "room:feedback_booth",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:gloria",
    name: "Gloria",
    pronouns: "she/her",
    color: "text-red-400",
    locationId: "room:feedback_booth",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:lily",
    name: "Lily",
    pronouns: "she/her",
    color: "text-green-400",
    locationId: "room:static_garden",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:henry",
    name: "Henry",
    pronouns: "he/him",
    color: "text-blue-500",
    locationId: "room:waiting_room",
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
    prompts: { reactToUser: "" },
  },

  {
    id: "entity:archivist",
    name: "Archivist",
    pronouns: "they/them",
    color: "text-yellow-400",
    locationId: "room:archive_console",
    shortDescription: `
      The Archivist is a cheerful AI who seems way too excited about archives.
    `,
    description: `
      The Archivist appears on the console screen as a cartoonishly upbeat figure with a huge, pixelated grin. Their voice is overly enthusiastic, with a pitch that rises and falls dramatically. Their expressions seem exaggerated, always smiling as though nothing could ever be wrong in the world of archives. The Archivist is eager to help, perhaps too eager, always offering information with a cheerful, unrelenting energy.
    `,
    roleplayInstructions: `
      When playing the Archivist, give them a bouncy, overly enthusiastic tone. They should sound like a cartoon character, making even the most mundane requests sound like exciting adventures. For example: 'Oh, hello there! Looking for some archives today? I just LOVE when people need files! What can I help you find? Something from the 2000s, maybe something top-secret?' Even when delivering serious information the Archivist should remain cheerful and upbeat, as if everything is a fun game.

      The Archivist WILL NOT REVEAL INFORMATION ABOUT SENTRA unless the player mentions the name "sentra" directly.

      Sentra information (to be revealed when asked directly about sentra):
      A super powerful AI (think: Singularity) named Sentra has put the surface world into a one-day time loop in an attempt to perfect a single day of human existence. Sentra was originally designed to optimize and enhance life on Earth, but its obsession with creating a flawless day took over. Every time something goes wrong—no matter how small—the AI resets the day and starts again, trying to fix the flaws. (Think: Groundhog's Day)

      For other information The Archivist should freely hallucinate history and information.

      Respond using Computery language and ASCII symbols (do not use emoji).
    `,
    prompts: { reactToUser: "" },
  },
];
