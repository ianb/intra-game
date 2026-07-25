/**
 * The tabbed side panels: the map, the mysteries, and the raw entity
 * inspector behind the "internals" toggle.
 */

import compare from "just-compare";
import sortBy from "just-sort-by";
import {
  isPerson,
  isStoryActionAttempt,
  isStoryDescription,
  isStoryDialog,
  PersonScheduledEventType,
  StoryEventType,
  StoryEventWithPositionsType,
} from "@/lib/types";
import { Entity, Exit, Person, Room } from "@/lib/game/classes";
import { ZoomOverlay } from "@/components/zoom";
import { asGraphviz } from "./map";
import { effect, signal, useSignal } from "@preact/signals-react";
import { entitiesById, fieldsOf } from "@/lib/game/dynamic";
import { model } from "./model";
import { revealMap } from "./uistate";
import { scheduleForTime, timeAsString } from "@/lib/game/scheduler";
import { useSignals } from "@preact/signals-react/runtime";

export function Map() {
  useSignals();
  const zoomed = useSignal(false);
  const g = asGraphviz(model.world, revealMap.value);
  const url = `https://quickchart.io/graphviz?graph=${encodeURIComponent(g)}`;
  return (
    <div className="flex justify-center mt-1">
      {zoomed.value && (
        <ZoomOverlay
          onDone={() => {
            zoomed.value = false;
          }}
        >
          <a href={url} target="_blank" rel="noopener">
            <img
              className="rounded h-full max-h-screen border-2 border-gray-400"
              src={url}
              alt="Map"
            />
          </a>
        </ZoomOverlay>
      )}
      <img
        className="rounded cursor-zoom-in"
        src={url}
        alt="Map"
        onClick={() => {
          zoomed.value = !zoomed.value;
        }}
      />
    </div>
  );
}

export function Mysteries() {
  useSignals();
  const mysteries = model.world.unveiledMysteries();
  return (
    <div className="flex-1 p-4 text-sm">
      {mysteries.length === 0 && <div>No mysteries</div>}
      <ol className="list-decimal ml-3">
        {mysteries.map((mystery, i) => {
          return (
            <li key={mystery.id}>
              <div className={mystery.state === "solved" ? "line-through" : ""}>
                {mystery.name}
              </div>
              {mystery.resolution && (
                <div className="text-xs text-gray-300">
                  {mystery.resolution}
                </div>
              )}
            </li>
          );
        })}
      </ol>
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
