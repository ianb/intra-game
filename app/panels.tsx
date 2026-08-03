/**
 * The tabbed side panels: the map, the player's list, and the raw entity
 * inspector behind the "internals" toggle.
 */

import compare from "just-compare";
import sortBy from "just-sort-by";
import {
  isMystery,
  isPerson,
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
  PersonScheduledEventType,
  StoryEventType,
  StoryEventWithPositionsType,
} from "@/lib/types";
import { Entity, Exit, Person, Room } from "@/lib/game/classes";
import { ZoomableImage } from "@/components/zoomableimage";
import { useSignal } from "@preact/signals-react";
import { entitiesById, fieldsOf } from "@/lib/game/dynamic";
import { imageForEntity } from "./images";
import { model } from "./model";
import { scheduleForTime, timeAsString } from "@/lib/game/scheduler";
import { useSignals } from "@preact/signals-react/runtime";

/**
 * The current room's image, shown above the HUD tabs as a scene viewport.
 *
 * Driven by the current room the same way soundtrack.ts drives audio: it reads
 * PLAYER.inside and re-renders on every story update. Rooms without a generated
 * image render nothing, so this is safe to mount before every room is imaged.
 */
export function RoomImage() {
  useSignals();
  const _updates = model.updates.value;
  const room = model.world.getRoom(model.world.entities.PLAYER.inside);
  const url = room ? imageForEntity(room.id) : undefined;
  if (!url || !room) {
    return null;
  }
  return (
    <div className="relative shrink-0 border-b border-gray-700">
      <ZoomableImage src={url} alt={room.name} className="w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-2 pb-2">
        <span className="pixel-title text-center text-[12px] leading-[1.5]">
          {room.name}
        </span>
      </div>
    </div>
  );
}

/**
 * The player's list: errands and mysteries together.
 *
 * Mysteries used to live in a tab of their own, which meant the game's biggest
 * open questions sat in a list the player had to remember to go and look at.
 * They are the same kind of thing as everything else here — something you are
 * trying to do — so they are folded in (see mysteryTodos in world.ts), and the
 * separate panel is gone.
 *
 * Finished entries stay, struck through, rather than disappearing: half the
 * value of a list is seeing what you already did, and in a game where an NPC can
 * wander off mid-errand, "did that actually count?" is a real question.
 */
export function Todos() {
  useSignals();
  const _updates = model.updates.value;
  const todos = model.world.todos;
  return (
    <div className="flex-1 p-4 text-sm">
      {todos.length === 0 && (
        <div className="text-gray-400">
          Nothing on your list. It fills in as people ask you to do things.
        </div>
      )}
      <ul>
        {todos.map((todo) => {
          // A solved mystery has a resolution worth reading; that is what the
          // old mysteries panel was carrying that a bare title doesn't.
          const source = todo.from
            ? model.world.getEntity(todo.from)
            : undefined;
          const resolution =
            source && isMystery(source) ? source.resolution : undefined;
          return (
            <li key={todo.id} className="mb-2">
              <span className={todo.done ? "text-gray-500" : "text-gray-400"}>
                {todo.done ? "☑ " : "☐ "}
              </span>
              <span className={todo.done ? "line-through text-gray-500" : ""}>
                {todo.title}
              </span>
              {resolution && (
                <div className="text-xs text-gray-300 ml-5">{resolution}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ViewObjects() {
  useSignals();
  const idList = model.updates.value
    .map((update) => Object.keys(update.changes))
    .flat();
  const unsortedEntities = Object.values(model.world.entities);
  const entities = sortBy(unsortedEntities, (entity) => {
    let index = idList.lastIndexOf(entity.id);
    index = idList.length - index;
    index *= 1000;
    index += unsortedEntities.indexOf(entity);
    return index;
  });
  return (
    <div>
      <div className="text-xs text-gray-300 mx-2">
        Below is a list of all objects, and the edits made to those objects over
        the course of the game
      </div>
      {entities.map((entity) => {
        return (
          <ViewObject
            key={entity.id}
            id={entity.id}
            entity={entity}
            updates={model.updates.value}
          />
        );
      })}
    </div>
  );
}

function ViewObject({
  id,
  entity,
  updates,
}: {
  id: string;
  entity: Entity;
  updates: StoryEventType[];
}) {
  useSignals();
  const hide = useSignal(true);
  const lines = [];
  for (const [key, value] of Object.entries(entity)) {
    if (key === "world") {
      continue;
    }
    if (key === "todaysSchedule") {
      lines.push(`todaysSchedule:`);
      for (const item of value as PersonScheduledEventType[]) {
        const schedule = scheduleForTime(entity as Person, item.time);
        lines.push(
          `  ${timeAsString(item.time)}-${timeAsString(item.time + item.minuteLength)}: (${schedule?.inside.join("/")}) ${schedule?.activity || item.scheduleId}${schedule?.attentive ? " (attentive)" : ""}`,
        );
        if (schedule?.secret) {
          lines.push(`    secret: ${schedule?.secretReason}`);
        }
      }
      continue;
    }
    const original = entitiesById(model.world.original)[id];
    if (!compare(value, original && fieldsOf(original)[key])) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  return (
    <div className="p-2 text-xs">
      <div
        className="bg-blue-900 text-white p-1 cursor-default"
        onClick={() => {
          hide.value = !hide.value;
        }}
      >
        {entity.id} {entity.name !== entity.id ? entity.name : ""}{" "}
        {lines.length > 0 && `(${lines.length})`}
      </div>
      {!hide.value && (
        <>
          <pre className="whitespace-pre-wrap text-white bg-gray-900 pl-1">
            {lines.join("\n")}
          </pre>
        </>
      )}
    </div>
  );
}
