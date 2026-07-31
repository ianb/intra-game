import { isPerson, isRoom } from "../types";
import type { EntityId } from "../types";
import { pathTo } from "./pathto";
import type { World } from "./world";

/**
 * `/nav <room or person>` — the cuff.
 *
 * Every citizen is fitted with one at intake and it does not come off, which is
 * a mechanical convenience dressed as a policy: a device the player could lose
 * would be a device the game had to handle them losing.
 *
 * It is a computer, not a conversationalist. That is the whole design: it does
 * not talk, cannot be asked follow-up questions, has no opinion, and costs
 * nothing to use, where asking Ama the same thing would be a turn of
 * conversation with someone who has views about why you want to know. Its
 * output is a readout — clipped, unpunctuated, no voice — and deliberately
 * unlike every other register in the game.
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
  /** What the cuff displays. A readout, not speech. */
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
    return { text: "/nav <room or person>" };
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
      // Not "in their quarters". The cuff does not know why and would not say
      // if it did; naming the room would make the exclusion pointless.
      return { text: `${person.name} — no route.` };
    }
    if (where.id === here) {
      return { text: `${person.name} — here.` };
    }
    return directions(world, here, where.id, `${person.name} — ${where.name}`);
  }

  if (room) {
    if (room.onNav === false) {
      return { text: `${room.name} — no route.` };
    }
    if (room.id === here) {
      return { text: `${room.name} — here.` };
    }
    return directions(world, here, room.id, "");
  }

  return { text: `${argument.trim()} — no match.` };
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
    return { text: `${lead ? lead + "\n" : ""}No route.` };
  }
  const named = path.map((id) => world.getRoom(id)?.name ?? id);
  const steps = `Route: ${named.join(", ")}`;
  return { text: `${lead ? lead + "\n" : ""}${steps}`, path };
}
