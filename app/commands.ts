/**
 * Slash commands typed into the composer. These act on the display directly;
 * they are not turns sent to the game.
 *
 *   /teleport <room or person>  jump straight there (this moves you)
 *   /nav <room or person>       say where it is and the way there (no move)
 *
 * Matching is fuzzy: spaces become underscores and the query is a
 * case-insensitive substring of the entity id, so "/nav joyous" finds the
 * Joyous Café and "/nav lily" finds wherever Lily is. A person wins a tie over
 * a room, so a bare name lands on the person rather than their quarters (whose
 * id also contains the name).
 */

import { isPerson, isRoom } from "@/lib/types";
import type { StoryActionType } from "@/lib/types";
import type { Person, Room } from "@/lib/game/classes";
import { navigate } from "@/lib/game/nav";
import { model } from "./model";

interface Target {
  room: Room;
  person?: Person; // set when the query matched a person, for the message
}

function resolve(argument: string): Target | undefined {
  const query = argument.trim().replace(/ /g, "_").toLowerCase();
  if (!query) {
    return undefined;
  }
  const entities = Object.values(model.world.entities);
  const match = (id: string) => id.toLowerCase().includes(query);
  const room = entities.filter(isRoom).find((entity) => match(entity.id));
  const person = entities.filter(isPerson).find((entity) => match(entity.id));
  const personRoom = person ? model.world.getRoom(person.inside) : undefined;
  const targetRoom = personRoom ?? room;
  if (!targetRoom) {
    return undefined;
  }
  return { room: targetRoom, person: personRoom ? person : undefined };
}

export function teleport(argument: string): void {
  if (!argument.trim()) {
    narrate("Usage: /teleport <room or person>");
    return;
  }
  const target = resolve(argument);
  if (!target) {
    narrate(`/teleport: nothing matching "${argument.trim()}".`);
    return;
  }
  const player = model.world.entities.PLAYER;
  if (player.inside === target.room.id) {
    narrate(`Already in ${target.room.name}.`);
    return;
  }
  model.appendRemoteEvents([
    {
      id: "PLAYER",
      roomId: target.room.id,
      totalTime: 0,
      changes: {
        PLAYER: {
          before: { inside: player.inside },
          after: { inside: target.room.id },
        },
      },
      actions: [],
    },
  ]);
}

export function nav(argument: string): void {
  narrate(navigate(model.world, argument).text);
}

export function unknownCommand(text: string): void {
  const name = text.split(/\s/)[0];
  narrate(`Unknown command ${name}. Try /teleport, /nav, or /restart.`);
}

function narrate(text: string): void {
  const action: StoryActionType = { type: "description", text };
  model.appendRemoteEvents([
    {
      id: "narrator",
      roomId: model.world.entities.PLAYER.inside,
      totalTime: 0,
      changes: {},
      actions: [action],
      uiOnly: true,
    },
  ]);
}
