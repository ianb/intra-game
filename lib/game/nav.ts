import { isPerson, isRoom } from "../types";
import type { EntityId } from "../types";
import { pathTo } from "./pathto";
import type { World } from "./world";

/**
 * `/nav <room or person>` — directions, from Ama.
 *
 * A first-class part of play rather than a dev command. Intra is a bunker run
 * by an AI who monitors everyone and is relentlessly helpful about small
 * practical things; asking her where something is and being told is exactly
 * what she is for.
 *
 * It exists because finding people is where play actually breaks down. Across
 * five recorded quest runs the agent never once fumbled a command, but burned
 * three to six turns each on repeats, and the snag log has it walking to
 * "Archive Sub-Level 4" — a room the Archivist invented, confidently, with
 * directions. A player who cannot find anyone spends the game in corridors.
 *
 * Directions, not travel: this says which way to go and the player still walks
 * it. `/teleport` (app/teleport.ts) is the one that moves you, and it is a dev
 * command for looking at rooms.
 *
 * Not everywhere is on it. A room with `onNav: false` — bedrooms — is not
 * listed and cannot be routed to, and anyone in one is simply not findable.
 * That is the seam for anything later that should hide a person: being
 * unfindable is a property of where they are, not a special case here.
 */

export interface NavResult {
  /** What to tell the player, in Ama's voice. */
  text: string;
  /** The rooms to walk, in order, when there is a route. */
  path?: EntityId[];
}

/** Fuzzy id match, the same shape /teleport uses: "joyous" finds Joyous_Cafe. */
function matches(id: string, query: string): boolean {
  return id.toLowerCase().includes(query);
}

export function navigate(world: World, argument: string): NavResult {
  const query = argument.trim().replace(/ /g, "_").toLowerCase();
  if (!query) {
    return { text: "Where would you like to go? Try /nav followed by a room or a person's name." };
  }

  const entities = Object.values(world.entities);
  // A person wins a tie over a room, so a bare name finds the person rather
  // than their quarters, whose id contains their name too.
  const person = entities.filter(isPerson).find((e) => matches(e.id, query));
  const room = entities.filter(isRoom).find((e) => matches(e.id, query));

  const here = world.entities.PLAYER.inside;

  if (person) {
    const where = world.getRoom(person.inside);
    if (!where || where.onNav === false) {
      // Deliberately not "they are in their quarters". Somewhere off the map is
      // somewhere Ama will not route you to, and saying which room would make
      // the exclusion pointless.
      return {
        text: `I can't help you find ${person.name} at the moment. They aren't anywhere I can direct you to.`,
      };
    }
    if (where.id === here) {
      return { text: `${person.name} is here, with you.` };
    }
    return directions(world, here, where.id, `${person.name} is in ${where.name}.`);
  }

  if (room) {
    if (room.onNav === false) {
      return { text: `${room.name} isn't somewhere I can direct you to.` };
    }
    if (room.id === here) {
      return { text: `You're in ${room.name} now.` };
    }
    return directions(world, here, room.id, "");
  }

  return {
    text: `I don't have anywhere called "${argument.trim()}" on the map, and nobody by that name.`,
  };
}

/** The walk itself, as a list of rooms to go to in order. */
function directions(
  world: World,
  from: EntityId,
  to: EntityId,
  lead: string,
): NavResult {
  const path = pathTo(world, from, to);
  if (!path.length) {
    return {
      text: `${lead} I can't find a way there from ${world.getRoom(from)?.name ?? "here"}.`.trim(),
    };
  }
  const named = path.map((id) => world.getRoom(id)?.name ?? id);
  const steps =
    named.length === 1
      ? `Go to ${named[0]}.`
      : `Go to ${named.join(", then ")}.`;
  return { text: `${lead} ${steps}`.trim(), path };
}
