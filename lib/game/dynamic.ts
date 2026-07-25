import type { EntityId } from "../types";
import type { Entity } from "./classes";

/**
 * The blessed places where the entity model's dynamism is expressed.
 *
 * The game is deliberately dynamic in two ways: `<set attr="PLAYER.name">` can
 * address any field on any entity by string, and the world is one big named
 * object that gets indexed by entity id. Both need a cast to express in
 * TypeScript. Keeping those casts here — rather than sprinkling `as any`
 * through the engine — means the unsafe surface is small, named, and greppable.
 */

/** An entity's fields, addressed dynamically by name. */
export function fieldsOf(entity: object): Record<string, unknown> {
  return entity as unknown as Record<string, unknown>;
}

/** The world's entity map, indexed by id (missing ids give undefined). */
export function entitiesById(
  entities: object,
): Record<EntityId, Entity | undefined> {
  return entities as unknown as Record<EntityId, Entity | undefined>;
}
