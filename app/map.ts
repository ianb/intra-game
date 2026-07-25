import colors from "tailwindcss/colors";
import { exposeGlobal } from "@/lib/debugglobal";
import { tmpl } from "@/lib/template";
import type { World } from "@/lib/game/world";

// Renders the world as a Graphviz digraph for the in-game map.
//
// This is a view concern: it reaches for Tailwind's colour palette and only
// exists to draw a picture, so it lives with the UI rather than in the engine
// (which must stay free of styling and browser dependencies so it can run
// server-side).

export function asGraphviz(world: World, fullMap = false): string {
  const roomList: string[] = [];
  const connectionList: string[] = [];
  const playerRoom = world.entityRoom("player");
  exposeGlobal("colors", colors);
  const allRooms = world.rooms.filter((room) => {
    return !world.getRoom(room)?.excludeFromMap && room !== playerRoom.id;
  });
  let rooms = allRooms;
  const skipExits: string[] = [];
  if (!fullMap) {
    rooms = [];
    for (const room of world.rooms) {
      const roomObj = world.getRoom(room);
      if (!roomObj) {
        throw new Error(`No room with id: ${room}`);
      }
      if (roomObj.excludeFromMap && playerRoom.id !== roomObj.id) {
        continue;
      }
      if (roomObj.visits > 0) {
        rooms.push(room);
      }
    }
  }
  for (const room of [...rooms]) {
    for (const exit of world.getRoom(room)?.exits || []) {
      if (
        world.getRoom(exit.roomId)?.excludeFromMap &&
        playerRoom.id !== exit.roomId
      ) {
        continue;
      }
      if (!rooms.includes(exit.roomId)) {
        rooms.push(exit.roomId);
        skipExits.push(exit.roomId);
      }
    }
  }
  for (const room of rooms) {
    const roomObj = world.getRoom(room);
    if (!roomObj) {
      throw new Error(`No room with id: ${room}`);
    }
    const colorName = roomObj.color || "text-white";
    const color = convertColorName(colorName);
    const occupants = skipExits.includes(room)
      ? []
      : world.entitiesInRoom(roomObj).map((entity) => entity.name);
    const headerColor = skipExits.includes(room) ? "black" : "white";
    const lines = [`<TABLE BORDER="0">`];
    lines.push(
      `<TR><TD ALIGN="CENTER"><FONT COLOR="${headerColor}"><B>${roomObj.name}</B></FONT></TD></TR>`
    );
    for (const occupant of occupants) {
      if (!occupant) {
        continue;
      }
      lines.push(
        `<TR><TD ALIGN="LEFT"><FONT COLOR="white" POINT-SIZE="8">${occupant}</FONT></TD></TR>`
      );
    }
    lines.push("</TABLE>");
    const shape =
      playerRoom!.id == roomObj.id
        ? '  shape=box, peripheries=2, color="white",'
        : "";
    roomList.push(
      tmpl`
      ${roomObj.id} [
        ${shape}
        label=<${lines.join("\n")}>,
        fillcolor="${color}",
        style="filled",
      ];
    `
    );
    if (!skipExits.includes(room)) {
      for (const exit of roomObj.exits) {
        if (
          world.getRoom(exit.roomId)?.excludeFromMap &&
          playerRoom.id !== exit.roomId
        ) {
          continue;
        }
        connectionList.push(
          tmpl`
        ${roomObj.id} -> ${exit.roomId};
      `
        );
      }
    }
  }
  return tmpl`
    digraph G {
      label="The Intra Complex";
      labelloc="t";
      labeljust="r";
      fontname="Helvetica";
      fontcolor="white";
      fontsize=13;
      bgcolor="#111827";
      edge [color="white"];
      node [shape=record, style=filled, fontsize=12, fontname="Helvetica"];

      ${roomList.join("\n")}

      ${connectionList.join("\n")}
    }
  `;
}

function convertColorName(color: string): string {
  const c = color.replace(/^text-/, "");
  const parts = c.split("-");
  // Tailwind's palette is a nested object ("emerald" -> "400" -> "#..."), and
  // the class names we walk it with come from entity definitions.
  let pos: unknown = colors;
  for (const part of parts) {
    if (pos && typeof pos === "object") {
      pos = (pos as Record<string, unknown>)[part];
    }
  }
  if (typeof pos !== "string") {
    console.warn("Could not find color", color);
    return "1.0 1.0 1.0";
  }
  return pos;
}
