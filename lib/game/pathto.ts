import { EntityId } from "../types";
import type { World } from "./world";

export function pathTo(
  world: World,
  current: EntityId,
  dest: EntityId
): EntityId[] {
  const visited = new Set<EntityId>();
  const queue = [[current]];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];
    if (node === dest) {
      // The first element is the current room, so we skip it
      return path.slice(1);
    }
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    const room = world.getRoom(node);
    if (!room) {
      continue;
    }
    for (const exit of room.exits) {
      const neighbor = exit.roomId;
      queue.push([...path, neighbor]);
    }
  }
  return [];
}
