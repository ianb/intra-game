import colors from "tailwindcss/colors";
import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { ZoomOverlay } from "@/components/zoom";
import { MAP_LAYOUT, type MapCell } from "./maplayout";
import { model } from "./model";
import { playTurn, turnRunning } from "./session";
import { revealMap } from "./uistate";
import type { World } from "@/lib/game/world";

// A grid map of the complex, drawn as inline SVG. Rooms sit at fixed cells (see
// maplayout.ts) so the map is stable; edges are the exits between them. This
// keeps the fog (only visited rooms and their immediate neighbours) and the
// people-in-room knowledge the old Graphviz map showed, with no external
// image service.

const CELL = 104; // px per grid cell
const GAP = 18; // space between room boxes
const PAD = 14; // padding around the whole map

interface Placed {
  id: string;
  cell: MapCell;
  stub: boolean; // an unvisited neighbour, shown only as a labelled door
  name: string;
  color: string;
  occupants: string[];
  isPlayer: boolean;
}

function colorHex(name: string): string {
  const parts = name.replace(/^text-/, "").split("-");
  let pos: unknown = colors;
  for (const part of parts) {
    if (pos && typeof pos === "object") {
      pos = (pos as Record<string, unknown>)[part];
    }
  }
  return typeof pos === "string" ? pos : "#9ca3af";
}

// Fog: visited rooms are full; their unvisited neighbours are stubs; the rest
// are hidden. revealMap shows everything. Mirrors the old asGraphviz logic.
function placeRooms(world: World, reveal: boolean): Placed[] {
  const player = world.entityRoom("PLAYER");
  const onMap = (id: string) => {
    const room = world.getRoom(id);
    if (!room || !MAP_LAYOUT[id]) return false;
    return !room.excludeFromMap || id === player.id;
  };

  const visible = new Map<string, boolean>(); // id -> isStub
  for (const id of world.rooms) {
    if (!onMap(id)) continue;
    if (reveal || (world.getRoom(id)?.visits ?? 0) > 0) visible.set(id, false);
  }
  if (!reveal) {
    for (const id of [...visible.keys()]) {
      for (const exit of world.getRoom(id)?.exits ?? []) {
        if (onMap(exit.roomId) && !visible.has(exit.roomId)) {
          visible.set(exit.roomId, true);
        }
      }
    }
  }

  const placed: Placed[] = [];
  for (const [id, stub] of visible) {
    const room = world.getRoom(id)!;
    placed.push({
      id,
      cell: MAP_LAYOUT[id]!,
      stub,
      name: room.name,
      color: colorHex(room.color || "text-white"),
      occupants: stub
        ? []
        : world
            .entitiesInRoom(room)
            .map((entity) => entity.name)
            .filter(Boolean),
      isPlayer: id === player.id,
    });
  }
  return placed;
}

function center(cell: MapCell): { cx: number; cy: number } {
  const w = cell.w ?? 1;
  const h = cell.h ?? 1;
  return { cx: (cell.x + w / 2) * CELL, cy: (cell.y + h / 2) * CELL };
}

function edgesOf(world: World, placed: Placed[]): [Placed, Placed][] {
  const byId = new Map(placed.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const result: [Placed, Placed][] = [];
  for (const from of placed) {
    if (from.stub) continue; // stubs don't reveal where they lead
    for (const exit of world.getRoom(from.id)?.exits ?? []) {
      const to = byId.get(exit.roomId);
      if (!to) continue;
      const key = [from.id, to.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push([from, to]);
    }
  }
  return result;
}

function MapSvg({ world, reveal }: { world: World; reveal: boolean }) {
  const placed = placeRooms(world, reveal);
  if (!placed.length) {
    return null;
  }
  const edges = edgesOf(world, placed);

  // Rooms reachable in one step from where the player is: clicking one walks
  // there (the game still enforces locked doors and the like). Includes the
  // dashed stubs, which is how you step into somewhere new.
  const here = world.entityRoom("PLAYER");
  const neighbors = new Set((here.exits ?? []).map((exit) => exit.roomId));
  const goTo = (name: string) => {
    if (!turnRunning.value) {
      void playTurn(`Go to ${name}`);
    }
  };

  const minX = Math.min(...placed.map((p) => p.cell.x));
  const minY = Math.min(...placed.map((p) => p.cell.y));
  const maxX = Math.max(...placed.map((p) => p.cell.x + (p.cell.w ?? 1)));
  const maxY = Math.max(...placed.map((p) => p.cell.y + (p.cell.h ?? 1)));
  const vb = [
    minX * CELL - PAD,
    minY * CELL - PAD,
    (maxX - minX) * CELL + 2 * PAD,
    (maxY - minY) * CELL + 2 * PAD,
  ].join(" ");

  return (
    <svg
      viewBox={vb}
      style={{ width: "100%", height: "auto" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {edges.map(([a, b]) => {
        const from = center(a.cell);
        const to = center(b.cell);
        return (
          <line
            key={`${a.id}|${b.id}`}
            x1={from.cx}
            y1={from.cy}
            x2={to.cx}
            y2={to.cy}
            stroke="#4b5563"
            strokeWidth={3}
          />
        );
      })}
      {placed.map((p) => {
        const w = (p.cell.w ?? 1) * CELL - GAP;
        const h = (p.cell.h ?? 1) * CELL - GAP;
        const x = p.cell.x * CELL + GAP / 2;
        const y = p.cell.y * CELL + GAP / 2;
        const canGo = neighbors.has(p.id);
        return (
          <g
            key={p.id}
            className={canGo ? "cursor-pointer" : undefined}
            onClick={
              canGo
                ? (event) => {
                    event.stopPropagation(); // don't also open the zoom
                    goTo(p.name);
                  }
                : undefined
            }
          >
            {canGo && <title>Go to {p.name}</title>}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={8}
              fill={p.stub ? "#0b1220" : "#1f2937"}
              stroke={p.isPlayer ? "#ffffff" : p.color}
              strokeWidth={p.isPlayer ? 4 : 2}
              strokeDasharray={p.stub ? "5 5" : undefined}
              strokeOpacity={p.stub ? 0.5 : 1}
            />
            <foreignObject x={x} y={y} width={w} height={h}>
              {/* Name pinned at the top so a crowded room can't push it off the
                  top edge; extra occupants clip at the bottom instead. */}
              <div className="flex h-full w-full flex-col items-center justify-start overflow-hidden px-1 pt-1 text-center leading-tight">
                <div
                  className="font-bold"
                  style={{
                    fontSize: "13px",
                    color: p.isPlayer ? "#ffffff" : p.color,
                    opacity: p.stub ? 0.55 : 1,
                  }}
                >
                  {p.name}
                </div>
                {p.occupants.map((occupant) => (
                  <div key={occupant} className="text-[10px] text-gray-300">
                    {occupant}
                  </div>
                ))}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

export function RoomMap() {
  useSignals();
  void model.updates.value;
  const zoomed = useSignal(false);
  const reveal = revealMap.value;
  return (
    <div className="mt-1 flex justify-center">
      {zoomed.value && (
        <ZoomOverlay onDone={() => (zoomed.value = false)}>
          <div
            className="max-h-[88vh] cursor-zoom-out overflow-auto rounded bg-gray-900 p-3"
            style={{ width: "80vw" }}
            onClick={() => (zoomed.value = false)}
          >
            <MapSvg world={model.world} reveal={reveal} />
          </div>
        </ZoomOverlay>
      )}
      <div
        className="w-full cursor-zoom-in"
        onClick={() => (zoomed.value = true)}
      >
        <MapSvg world={model.world} reveal={reveal} />
      </div>
    </div>
  );
}
