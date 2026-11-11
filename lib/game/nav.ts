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
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[\s_]+/g, "_");
}

function matches(entity: { id: string; name: string }, query: string): boolean {
  return (
    normalize(entity.id).includes(query) ||
    normalize(entity.name).includes(query)
  );
}

export function navigate(world: World, argument: string): NavResult {
  const query = normalize(argument);
  if (!query) {
    const here = world.getRoom(world.entities.PLAYER.inside)!;
    const exits = here.exits
      .filter((e) => !e.sealed && world.getRoom(e.roomId)?.onNav !== false)
      .map((e) => world.getRoom(e.roomId)!.name);
    return {
      text: `You are in ${here.name}.\nNearby: ${exits.join(", ") || "no public exits"}.\nFind someone: /nav Marta\nFind a room: /nav Archive Console\nDirections are free and do not move you or advance time. Walk to the first room shown, then check again; people can move.`,
    };
  }

  const entities = Object.values(world.entities);
  // A person wins a tie over a room, so a bare name finds the person rather
  // than their quarters, whose id contains their name too.
  const person = entities.filter(isPerson).find((e) => matches(e, query));
  const room = entities.filter(isRoom).find((e) => matches(e, query));

  const here = world.entities.PLAYER.inside;

  if (person) {
    const where = world.getRoom(person.inside);
    if (!where || where.onNav === false) {
      // Not "in their quarters". The cuff does not know why and would not say
      // if it did; naming the room would make the exclusion pointless.
      return {
        text: `${person.name} — not on the public cuff map. Ask Ama where you can meet them.`,
      };
    }
    if (where.id === here) {
      return { text: `${person.name} — here.` };
    }
    return directions(world, here, where.id, `${person.name} — ${where.name}`);
  }

  if (room) {
    if (room.onNav === false) {
      return {
        text: `${room.name} — not on the public cuff map. Ask Ama about access.`,
      };
    }
    if (room.id === here) {
      return { text: `${room.name} — here.` };
    }
    return directions(world, here, room.id, "");
  }

  return {
    text: `${argument.trim()} — no match. Try a person's name, part of a room name, or /nav for nearby rooms.`,
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
      text: `${lead ? lead + "\n" : ""}No open route. Ask Ama about access, or use /nav to see nearby rooms.`,
    };
  }
  const named = path.map((id) => world.getRoom(id)?.name ?? id);
  const steps = `Route: ${named.join(", ")}\nNext: type "go to ${named[0]}". Check /nav again after walking; people can move.`;
  return { text: `${lead ? lead + "\n" : ""}${steps}`, path };
}
