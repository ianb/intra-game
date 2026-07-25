import { dedent } from "../../template";
import { AmaClass, NarratorClass, PlayerClass } from "../classes";
import { fieldsOf } from "../dynamic";
import { yourAge, intraLocation, Ink_And_Echo } from "./mysteries";
import {
  Marta,
  Frida,
  June,
  Doug,
  Lana,
  Harold,
  Greg,
  Milton,
  Gloria,
  Lily,
  Henry,
  Archivist,
} from "./people";
import {
  Quarters_Doug,
  Quarters_Marta,
  Quarters_Frida,
  Quarters_June,
  Quarters_Lana,
  Quarters_Harold,
  Quarters_Greg,
  Quarters_Milton,
  Quarters_Gloria,
  Quarters_Lily,
  Quarters_Henry,
  Quarters_Yours,
} from "./quarters";
import {
  Intake,
  Foyer,
  Hollow_Atrium,
  Archive_Lounge,
  Archive_Console,
  Tranquil_Pool,
  Joyous_Cafe,
  Activity_Hub,
  Yellow_Room,
  Nursery,
  Solitude_Cubes,
  Ill_Fitting_Lounge,
  Feedback_Booth,
  Static_Garden,
  Quiet_Plaza,
  Waiting_Room,
  Hallway,
  Reflection_Chamber,
  Utility_Closet,
  Void,
} from "./rooms";

/**
 * All of the game's content, assembled.
 *
 * This is data, not logic — the behaviour lives in ../classes.ts, and the
 * engine folds the event log over these as its starting state. The files under
 * this directory are deliberately allowed to be longer than the rest of the
 * codebase (see the `lib/game/content` override in eslint.config.mjs): prose is
 * not code, and breaking a room's description across files would cost more than
 * it saves.
 *
 * The key order below is not cosmetic. Ama's prompt lists the cast and the map
 * by iterating this object, so reordering it rewrites her prompt — which the
 * playtest cassette will notice.
 */
export const entities = {
  // Special characters, whose behaviour is a class rather than a description:
  player: new PlayerClass({ id: "player", inside: "Intake" }),
  Ama: new AmaClass({ id: "Ama", inside: "player" }),
  narrator: new NarratorClass({ id: "narrator" }),

  // Characters (./people.ts):
  Marta,
  Frida,
  June,
  Doug,
  Lana,
  Harold,
  Greg,
  Milton,
  Gloria,
  Lily,
  Henry,
  Archivist,

  // Rooms (./rooms.ts):
  Intake,
  Foyer,
  Hollow_Atrium,
  Archive_Lounge,
  Archive_Console,
  Tranquil_Pool,
  Joyous_Cafe,
  Activity_Hub,
  Yellow_Room,
  Nursery,
  Solitude_Cubes,
  Ill_Fitting_Lounge,
  Feedback_Booth,
  Static_Garden,
  Quiet_Plaza,
  Waiting_Room,
  Hallway,

  // Personal quarters, off the Hallway (./quarters.ts):
  Quarters_Doug,
  Quarters_Marta,
  Quarters_Frida,
  Quarters_June,
  Quarters_Lana,
  Quarters_Harold,
  Quarters_Greg,
  Quarters_Milton,
  Quarters_Gloria,
  Quarters_Lily,
  Quarters_Henry,
  Quarters_Yours,

  // Isolated area for the conclusion of the game:
  Reflection_Chamber,
  Utility_Closet,
  Void,

  // Mysteries (./mysteries.ts):
  yourAge,
  intraLocation,
  Ink_And_Echo,
};

// Content is written as indented template literals for readability; strip that
// indentation once, here, so nothing downstream has to think about it.
for (const entity of Object.values(entities)) {
  for (const attr of [
    "shortDescription",
    "description",
    "roleplayInstructions",
    "userInputInstructions",
    "actionPrompt",
    "introduction",
  ]) {
    if (fieldsOf(entity)[attr]) {
      fieldsOf(entity)[attr] = dedent(fieldsOf(entity)[attr] as string);
    }
  }
  for (const attr of ["availableHints", "revealedHints", "solvedHints"]) {
    for (const [entityId, hint] of Object.entries(
      (fieldsOf(entity)[attr] as Record<string, unknown>) || {},
    )) {
      (fieldsOf(entity)[attr] as Record<string, string>)[entityId] = dedent(
        hint as string,
      );
    }
  }
}

export type AllEntitiesType = typeof entities;
