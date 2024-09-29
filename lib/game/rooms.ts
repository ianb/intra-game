import { RoomDefinitionType } from "../types";
import { tmpl } from "../template";
import type { Model } from "../model";

export const rooms: RoomDefinitionType[] = [
  {
    id: "room:intake",
    name: "Intake",
    shortDescription: `
    A small room with a padded examination table.
    `,
    description: tmpl`
    A small room with a padded examination table. The walls are lined with inscrutable equipment and screens, many of them non-functioning.
    `,
    color: "text-lime-500",
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
    shortDescription: `
    A simple room that serves only as a passage.
    `,
    description: tmpl`
    A small room, a passage from the intake area.
    `,
    color: "text-emerald-500",
    exits: [
      {
        roomId: "room:intake",
      },
    ],
  },
];
