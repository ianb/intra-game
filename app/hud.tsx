/**
 * The tabbed side panel under the sticky room image: where you are, the map,
 * quests, the object inspector, and save/load.
 */

import type { ReactNode } from "react";
import { Button, CheckButton } from "@/components/input";
import { Clock } from "@/components/digitalnumerals";
import { NormalControls, SaveLoad } from "./controls";
import { RoomMap } from "./mapview";
import { Todos, ViewObjects } from "./panels";
import { activeTab, revealMap, showInternals } from "./uistate";
import { model } from "./model";
import { twMerge } from "tailwind-merge";
import { useSignals } from "@preact/signals-react/runtime";

type TabKey = "here" | "map" | "quests" | "objs" | "save";

// Old stored tab names ("inv", "todo", "log", ...) map onto the current set so
// a returning player doesn't land on a blank panel.
function normalizeTab(value: string): TabKey {
  if (value === "map" || value === "objs" || value === "save") {
    return value;
  }
  if (value === "todo" || value === "quests" || value === "mysteries") {
    return "quests";
  }
  return "here";
}

function TabButton({
  tab,
  current,
  onClick,
  children,
}: {
  tab: TabKey;
  current: TabKey;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span
      onClick={onClick}
      className={twMerge(
        "cursor-pointer",
        tab === current && "bg-gray-100 px-1 text-black",
      )}
    >
      {children}
    </span>
  );
}

export function SidePanel() {
  useSignals();
  void model.updates.value;
  let tab = normalizeTab(activeTab.value);
  if (tab === "objs" && !showInternals.value) {
    tab = "here";
  }
  const openTodos = model.world.todos.filter((todo) => !todo.done).length;
  const select = (target: TabKey) => () => {
    activeTab.value = target;
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-700 px-3 py-2 text-sm">
        <TabButton tab="here" current={tab} onClick={select("here")}>
          here
        </TabButton>
        <TabButton tab="map" current={tab} onClick={select("map")}>
          map
        </TabButton>
        <TabButton tab="quests" current={tab} onClick={select("quests")}>
          quests{openTodos > 0 ? ` (${openTodos})` : ""}
        </TabButton>
        {showInternals.value && (
          <TabButton tab="objs" current={tab} onClick={select("objs")}>
            objs
          </TabButton>
        )}
        <TabButton tab="save" current={tab} onClick={select("save")}>
          save/load
        </TabButton>
        <span className="ml-auto flex items-center gap-2">
          {tab === "map" && (
            <Button
              className="bg-teal-800 p-1 text-xs opacity-50 hover:opacity-100"
              onClick={() => {
                revealMap.value = !revealMap.value;
              }}
            >
              {revealMap.value ? "revealed" : "normal"}
            </Button>
          )}
          <CheckButton
            signal={showInternals}
            on="Internals"
            off="Normal"
            className="text-xs"
          />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "here" && <NormalControls />}
        {tab === "map" && <RoomMap />}
        {tab === "quests" && <Todos />}
        {tab === "objs" && <ViewObjects />}
        {tab === "save" && <SaveLoad />}
      </div>
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
