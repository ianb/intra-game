import { RoomType } from "../types";
import { tmpl } from "../template";
import type { Model } from "../model";

export const rooms: RoomType[] = [
  {
    id: "room:intake",
    name: "Intake",
    description: tmpl`
    You wake up in a small room.
    `,
    color: "bg-gray-800",
    exits: [],
    state: {},

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
];
