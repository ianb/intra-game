/**
 * Dev command: /teleport <room or person>. Jump the player straight to a room,
 * or to the room a person is in. Handy for looking at rooms and character art
 * without playing there.
 *
 * Matching is fuzzy: spaces become underscores and the query is a
 * case-insensitive substring of the entity id, so "/teleport joyous" finds
 * Joyous_Cafe and "/teleport marta" goes to wherever Marta is. A person wins a
 * tie over a room, so a bare name lands on the person rather than their
 * quarters (whose id also contains the name); "/teleport quarters marta" still
 * reaches the room.
 *
 * The move is folded straight into the world (appendRemoteEvents), so it fires
 * no turn and no NPC reactions. It is client-side only: in a server session the
 * server still thinks you are where its log says, so the next real turn snaps
 * you back. That is fine for previewing, which is all this is for.
 */

import { isPerson, isRoom } from "@/lib/types";
import type { StoryActionType } from "@/lib/types";
import { model } from "./model";

export function teleport(argument: string): void {
  const query = argument.trim().replace(/ /g, "_").toLowerCase();
  if (!query) {
    narrate("Usage: /teleport <room or person>");
    return;
  }

  const entities = Object.values(model.world.entities);
  const match = (id: string) => id.toLowerCase().includes(query);
  const room = entities.filter(isRoom).find((entity) => match(entity.id));
  const person = entities.filter(isPerson).find((entity) => match(entity.id));
  const destination =
    (person ? model.world.getRoom(person.inside) : undefined) ?? room;

  if (!destination) {
    narrate(`/teleport: no room or person matching "${argument.trim()}".`);
    return;
  }

  const player = model.world.entities.PLAYER;
  if (player.inside === destination.id) {
    narrate(`Already in ${destination.name}.`);
    return;
  }

  move(player.inside, destination.id);
}

function move(from: string, to: string): void {
  model.appendRemoteEvents([
    {
      id: "PLAYER",
      roomId: to,
      totalTime: 0,
      changes: { PLAYER: { before: { inside: from }, after: { inside: to } } },
      actions: [],
    },
  ]);
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
    },
  ]);
}
