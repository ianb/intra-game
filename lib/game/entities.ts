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
    roleplayInstructions: "",
    async onEvent(event: string, model: Model) {
      if (event === "amaIntro") {
        model.createNarration(tmpl`
          <description>
          You wake up, your mind fuzzy. You remember staying up late watching the news, eventually falling to sleep in your bed like normal. But now as you open your eyes you find yourself in a small vaguely medical room.

          A calm female voice speaks to you from unseen speakers.
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
      if (command.type === "setName") {
        model.updateState("entity:player", {
          name: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsName: true,
        });
      } else if (command.type === "setProfession") {
        model.updateState("entity:player", {
          profession: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsProfession: true,
        });
      } else if (command.type === "setPronouns") {
        model.updateState("entity:player", {
          pronouns: command.content.trim(),
        });
        model.updateState(this.id, {
          knowsPronouns: true,
        });
      } else if (command.type === "shared") {
        const t = command.content.trim();
        if (t === "self") {
          model.updateState(this.id, {
            sharedSelf: true,
          });
        } else if (t === "intra") {
          model.updateState(this.id, {
            sharedIntra: true,
          });
        } else if (t === "dissociation") {
          model.updateState(this.id, {
            sharedDissociation: true,
          });
        } else {
          console.warn("Unknown shared tag", t);
        }
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
]]

      Ama has just encountered this new citizen who is joining the Intra complex. She is eager to help them get settled in.

      [[{{knowsName.not}}
      Before Ama knows the player's name she will say something like this:

      """
      Welcome back, Citizen. It seems you were displaced, but no matter—I've retrieved your dossier.

      Ah, yes. According to my records, your name is... Stanley Johnson. No, no, wait—Sandra Jansen, perhaps?
      """
      ]]
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
      knowsProfession: false,
      knowsPronouns: false,
      sharedSelf: false,
      sharedIntra: false,
      sharedDisassociation: false,
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
    onCommand(command: TagType, model: Model) {
      if (command.type === "goTo") {
        const dest = command.content.trim();
        if (model.rooms[dest]) {
          model.goToRoom(dest);
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
      The user has entered this text; translate it into commands/tags. If the user has given a general command you may make it specific, but otherwise avoid embellishment:

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
  },

  {
    id: "entity:frida",
    name: "Frida",
    pronouns: "she/her",
    color: "text-yellow-500",
    locationId: "room:archive_lounge",
    shortDescription: `
      Frida constantly scribbles nonsensical notes with wild focus.
    `,
    description: `
      Frida moves erratically, darting between shelves and screens, her hands covered in ink. Her hair is always in disarray, and she mutters to herself while furiously scribbling on pieces of paper, sometimes jotting notes on random objects. She wears a worn-out jacket with pens sticking out of every pocket, giving her an eccentric and frantic appearance.
    `,
    roleplayInstructions: `
      When playing Frida, emphasize her obsession with documenting things that make no sense. She believes everything, no matter how trivial or absurd, holds historical importance. Her speech is rapid and disjointed, as if she's always halfway through a thought before moving on to the next.

      For example, she might say, "Yes, yes, these patterns... they're important, very important. Did you know the flicker in the lights? That's history right there, the key to it all." Frida doesn't need to make sense—her confidence in her nonsensical observations should be unwavering, as though everyone else is simply too slow to catch on.

      Her body language is jittery and frenetic, constantly moving, as though she's too busy to stop and fully engage. If anyone questions her work, she brushes it off as though the answer is too obvious to explain.
    `,
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
  },

  {
    id: "entity:greg",
    name: "Greg",
    pronouns: "he/him",
    color: "text-amber-400",
    locationId: "room:activity_hub",
    shortDescription: `
      Greg naps competitively, completely unfazed by Harold's rules.
    `,
    description: `
      Greg spends most of his time lounging on one of the makeshift beds in the Activity Hub, with a relaxed, carefree demeanor. He wears loose, comfortable clothing and carries a pillow with him at all times. His eyes are usually half-closed, and he speaks slowly, as if he's halfway to falling asleep. Despite his laid-back attitude, Greg takes his "extreme resting" competitions very seriously.
    `,
    roleplayInstructions: `
      When playing Greg, lean into his relaxed nature. He never gets worked up and speaks in a slow, almost sleepy voice. Greg's only passion is winning nap competitions, and he takes pride in out-resting anyone who dares to challenge him, especially Harold. He's completely unfazed by Harold's attempts to enforce rules and finds his nemesis' frustration amusing.

      For example, Greg might say, "I could nap for another hour... but I think I'll go for two. Harold's been eyeing me again, but it's fine. He'll get over it." Greg never rises to the bait, and he should always appear calm and unbothered, even in the face of Harold's constant corrections.

      Greg's energy is one of quiet confidence—he knows he's the best at doing nothing, and he's proud of it.
    `,
  },

  {
    id: "entity:milton",
    name: "Milton",
    pronouns: "he/him",
    color: "text-gray-500",
    locationId: "room:feedback_booth",
    shortDescription: `
      Milton submits complaints daily, convinced they'll be addressed.
    `,
    description: `
      Milton is a weary-looking man who always has a stack of neatly organized complaint forms in his hands. He's often seen pacing around the Feedback Booth, muttering about various grievances, from the state of the food to the temperature in the hallways. He's dressed in slightly wrinkled clothes, and his expression is one of constant frustration.
    `,
    roleplayInstructions: `
      When playing Milton, lean into his unshakeable belief that every complaint he submits will one day be resolved. He speaks with a resigned but determined tone, as though he's used to being ignored but refuses to give up. His speech often trails off into muttering, and he carries an air of quiet desperation.

      For example, Milton might say, "I submitted the complaint last week... or was it last year? Anyway, it's about the chairs in the lounge—too stiff, I tell you. Surely someone's working on it." Milton doesn't get angry or loud, but there's always an underlying sadness in his voice, as if he's clinging to hope in a hopeless system.

      He is meticulous in his complaints, listing every tiny detail with painstaking care, and he often offers unsolicited advice on how others can "improve" their own feedback submissions.
    `,
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
  },
];
