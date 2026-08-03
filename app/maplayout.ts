// Fixed grid positions for the map. The world is a graph (rooms linked by
// exits), but drawing it as a free graph moves rooms around between renders and
// is hard to read. Pinning each room to a grid cell keeps the map stable and
// legible. Positions are aesthetic only — the engine never reads them.
//
// x grows right, y grows down. w/h are in cells (default 1); a bigger room just
// spans more cells. Keep cells from overlapping. Rooms with no entry here are
// left off the map (the personal quarters and the Void).

export interface MapCell {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export const MAP_LAYOUT: Record<string, MapCell> = {
  // Entry corridor, into the hub.
  Intake: { x: 0, y: 2 },
  Foyer: { x: 1, y: 2 },
  Hollow_Atrium: { x: 2, y: 2 },
  Hallway: { x: 2, y: 1 },

  // The social loop, up and to the right of the hub.
  Archive_Console: { x: 3, y: 0 },
  Archive_Lounge: { x: 3, y: 1 },
  Tranquil_Pool: { x: 4, y: 1 },
  Activity_Hub: { x: 3, y: 2 },
  Joyous_Cafe: { x: 4, y: 2 },

  // The quiet cluster, below the hub.
  Yellow_Room: { x: 1, y: 3 },
  Solitude_Cubes: { x: 2, y: 3 },
  Waiting_Room: { x: 3, y: 3 },
  Static_Garden: { x: 1, y: 4 },
  Ill_Fitting_Lounge: { x: 2, y: 4 },
  Feedback_Booth: { x: 1, y: 5 },
  Quiet_Plaza: { x: 2, y: 5 },
  Nursery: { x: 3, y: 5 },

  // The endgame rooms, kept apart (reachable only late).
  Reflection_Chamber: { x: 5, y: 4 },
  Utility_Closet: { x: 5, y: 5 },
};
