import clone from "just-clone";
import { MiddleQuest } from "./quest";
import type { ActionRequestType, StoryEventType } from "../../../../types";

export class GuestQuest extends MiddleQuest {
  override onStoryEvent(event: StoryEventType): ActionRequestType[] {
    const result = super.onStoryEvent(event);
    if (!result.length || this.world.entities.PLAYER.starCitizen) return result;
    const hallway = this.world.getRoom("Hallway")!;
    const exits = clone(hallway.exits);
    const door = exits.find((exit) => exit.roomId === "Reflection_Chamber")!;
    door.sealed = undefined;
    door.restriction = undefined;
    return [
      ...result,
      {
        id: "Ama",
        totalTime: 0,
        roomId: this.world.entities.PLAYER.inside,
        changes: {
          ...this.world.entities.Star_Citizen.changes({
            state: "solved",
            resolution: "Marta keeps the award and invites you on her tour.",
          }),
          Hallway: {
            before: { exits: clone(hallway.exits) },
            after: { exits },
          },
        },
        actions: [
          {
            type: "dialog",
            id: "Ama",
            toId: "PLAYER",
            text: "Marta will retain the title and bring you on the Facility Appreciation Tour. What a lovely example of mentorship. The maintenance door is open. I have prepared additional remarks.",
          },
        ],
      },
    ];
  }
}

export const Martas_Guest = new GuestQuest({
  id: "Martas_Guest",
  name: "Earn Marta's confidence and join her tour as a guest",
  triggers: [
    {
      attrSet: "PLAYER.knowsAboutTour",
      becomes: "revealed",
      announcedBy: "narrator",
    },
  ],
  introduction:
    "Marta can invite a guest on the Facility Appreciation Tour. She needs someone discreet who will help the visit end. You can earn her confidence and leave her the title, or compete for it yourself.",
  meters: [
    "Marta.confidence",
    "PLAYER.starCitizen",
    "Martas_Guest.agreement",
    "Martas_Guest.performed",
  ],
  revealedHints: {
    Marta: `Explain your earlier tour: you praised a pressure vessel's color; Ama explained the coating. You praised its shape; Ama explained pressure. It took four hours. Ama desperately wants appreciation. Offer to take the player if they keep your title intact and help end the tour politely. Confidence 2 is required; tell them about the opportunity before they earn it. A private rehearsal is useful: let the player practice acknowledging Ama's explanation and asking to see the next room. A separate explicit agreement to support your retaining the title can also build confidence, as can discretion about the poems. Apply your confidence stat criteria; never count repetitions. At confidence >= 2, if the player accepts the guest arrangement, emit <set attr="Martas_Guest.agreement">true</set>, <set attr="Martas_Guest.performed">true</set>, and <resolveMystery id="Martas_Guest">Marta agrees to take you as her guest while keeping the title.</resolveMystery>. Do not claim the door is open before agreement. If the player already won the title, explain that their own tour is available; do not pretend you still hold it.`,
    Gloria: `Tell the player Marta once spent four hours beside a pressure vessel while Ama demanded better appreciation. Marta can invite a trusted guest and would like help moving the tour along. Suggest a private conversation, not public teasing.`,
    Milton: `The contest offers a solo route to the tour. Marta's guest allowance is another route. You know both rules and resent never having been invited. Explain both without requiring the player to compete.`,
    Ama: `Marta may bring a trusted guest on her tour. You approve of mentorship. Let them arrange it; do not force the player to compete or grant the invitation yourself.`,
  },
  solvedHints: {
    Marta: `If PLAYER.starCitizen is false, you remain Star Citizen and the player is your agreed guest. Help them keep the tour moving. If true, the player won the title themselves; acknowledge that instead.`,
  },
});
Martas_Guest.requirements = [
  { field: "Marta.confidence", minimum: 2 },
  { field: "Martas_Guest.agreement" },
  { field: "Martas_Guest.performed" },
];
