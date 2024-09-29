import { RoomDefinitionType } from "../types";
import { tmpl } from "../template";
import type { Model } from "../model";

export const rooms: RoomDefinitionType[] = [
  {
    id: "room:intake",
    name: "Intake",
    description: tmpl`
    You wake up in a small room.
    `,
    color: "bg-gray-800",
    exits: [
      {
        roomId: "room:foyer",
      },
    ],

    async onEvent(event: string, model: Model) {
      if (event === "enter") {
        console.log("entered", this.state.hasEntered);
        if (this.state.hasEntered) {
          return;
        }
        model.updateState(this.id, { hasEntered: true });
        model.sendEvent("amaIntro");
      }
    },
  },
  {
    id: "room:foyer",
    name: "Intake Foyer",
    description: tmpl`
    A small room, a passage from the intake area.
    `,
    color: "bg-violet-800",
    exits: [
      {
        roomId: "room:intake",
      },
    ],
  },
];
