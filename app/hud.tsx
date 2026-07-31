/**
 * The status strip above the transcript — where the player is, what time
 * it is, and what they're carrying.
 */

import { A, Button, CheckButton } from "@/components/input";
import { Clock } from "@/components/digitalnumerals";
import { RoomImage, Todos, ViewObjects } from "./panels";
import { RoomMap } from "./mapview";
import { activeTab, revealMap, showInternals } from "./uistate";
import { model } from "./model";
import { twMerge } from "tailwind-merge";
import { useSignals } from "@preact/signals-react/runtime";

export function HeadsUpDisplay() {
  useSignals();
  const activeClass = "text-black bg-gray-100 cursor-pointer";
  const inactiveClass = "cursor-pointer";
  const showLogs = true; // Could be based on showInternals or something, but I don't want it to be
  const _ = model.updates.value;
  const openTodos = model.world.todos.filter((todo) => !todo.done).length;
  return (
    <div className="h-2/3 p-4 border-b border-gray-700 overflow-y-auto">
      <RoomImage />
      <div>
        {activeTab.value === "map" && (
          <span className="float-right">
            <Button
              className="bg-teal-800 text-xs p-1 opacity-50 hover:opacity-100"
              onClick={() => {
                revealMap.value = !revealMap.value;
              }}
            >
              {revealMap.value ? "revealed" : "normal"}
            </Button>
          </span>
        )}
        <span
          onClick={() => {
            activeTab.value = "inv";
          }}
          className={activeTab.value === "inv" ? activeClass : inactiveClass}
        >
          inv
        </span>{" "}
        {/* <span
          onClick={() => {
            activeTab.value = "access";
          }}
          className={activeTab.value === "access" ? activeClass : inactiveClass}
        >
          (a)ccess
        </span>{" "}
        <span
          onClick={() => {
            activeTab.value = "blips";
          }}
          className={activeTab.value === "blips" ? activeClass : inactiveClass}
        >
          (b)lips
        </span>{" "} */}
        <span
          onClick={() => {
            activeTab.value = "map";
          }}
          className={activeTab.value === "map" ? activeClass : inactiveClass}
        >
          map
        </span>{" "}
        {model.world.todos.length > 0 && (
          <>
            <span
              onClick={() => {
                activeTab.value = "todo";
              }}
              className={
                activeTab.value === "todo" ? activeClass : inactiveClass
              }
            >
              todo{openTodos > 0 ? ` (${openTodos})` : ""}
            </span>{" "}
          </>
        )}
        {(showLogs || activeTab.value === "objs") && (
          <span
            onClick={() => {
              activeTab.value = "objs";
            }}
            className={activeTab.value === "objs" ? activeClass : inactiveClass}
          >
            objs
          </span>
        )}
      </div>
      <div>
        {activeTab.value === "inv" && <Inventory />}
        {activeTab.value === "access" && <AccessControl />}
        {activeTab.value === "blips" && <Blips />}
        {activeTab.value === "map" && <RoomMap />}
        {/* "mysteries" and "log" are retired tabs; anyone whose stored tab is
            still one of those gets something rather than a blank panel. The
            prompt log went with the browser-side engine that wrote it — what
            each turn sent is in the events now, under "show internals". */}
        {(activeTab.value === "todo" ||
          activeTab.value === "mysteries" ||
          activeTab.value === "log") && <Todos />}
        {activeTab.value === "objs" && <ViewObjects />}
      </div>
    </div>
  );
}

function Inventory() {
  useSignals();
  // This is *based* on updates, so I'm using this to keep it updated:
  const _updates = model.updates.value;
  const _player = model.world.entities.PLAYER;
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Inventory</div>
      (no inventory implemented)
      <div>- Key card</div>
    </div>
  );
}

function AccessControl() {
  useSignals();
  const _updates = model.updates.value;
  const _player = model.world.entities.PLAYER;
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Access Control</div>
      (no access control implemented)
    </div>
  );
}

function Blips() {
  useSignals();
  const _updates = model.updates.value;
  const _player = model.world.entities.PLAYER;
  return (
    <div className="flex-1 p-4">
      <div className="mb-2">Blips</div>
      (no blips implemented)
    </div>
  );
}

export function Time() {
  useSignals();
  // To declare its dependent on this...
  const _updates = model.updates.value;
  return (
    <Clock className="text-red-500" time={model.world.timeOfDay} bg="#1f2937" />
  );
}

export function TimePeriod({
  minutes,
  limit,
  className,
}: {
  minutes?: number;
  limit?: number;
  className?: string;
}) {
  useSignals();
  if (minutes === undefined) {
    return null;
  }
  let timeChar = "";
  if (minutes && minutes >= 10) {
    const timePeriod = Math.min(Math.round(minutes / 5), 11);
    timeChar = CLOCK_CHARS[timePeriod.toString()] || CLOCK_CHARS["11"]!;
  }
  if (limit !== undefined && minutes < limit) {
    return null;
  }
  return (
    <div
      className={twMerge("cursor-help opacity-50 hover:opacity-100", className)}
      title={`${minutes} minutes passed`}
    >
      {timeChar}
    </div>
  );
}

const CLOCK_CHARS: Record<string, string> = {
  "12": "🕛",
  "1": "🕐",
  "2": "🕑",
  "3": "🕒",
  "4": "🕓",
  "5": "🕔",
  "6": "🕕",
  "7": "🕖",
  "8": "🕗",
  "9": "🕘",
  "10": "🕙",
  "11": "🕚",
};
