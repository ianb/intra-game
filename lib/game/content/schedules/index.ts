import type { PersonScheduleTemplateType } from "../../../types";
import { juneSchedule } from "./june";
import { martaSchedule } from "./marta";
import { fridaSchedule } from "./frida";
import { dougSchedule } from "./doug";
import { lanaSchedule } from "./lana";
import { haroldSchedule } from "./harold";
import { gregSchedule } from "./greg";
import { gloriaSchedule } from "./gloria";
import { lilySchedule } from "./lily";
import { henrySchedule } from "./henry";

export { intraSchedule } from "./day";
export { time } from "./time";

/**
 * Each person's daily routine, keyed by entity id. A Person picks theirs up as
 * `scheduleTemplate`; the scheduler turns the template into concrete events
 * with a little randomness so two playthroughs don't march in lockstep.
 */
export const schedules: Record<string, PersonScheduleTemplateType[]> = {
  June: juneSchedule,
  Marta: martaSchedule,
  Frida: fridaSchedule,
  Doug: dougSchedule,
  Lana: lanaSchedule,
  Harold: haroldSchedule,
  Greg: gregSchedule,
  Gloria: gloriaSchedule,
  Lily: lilySchedule,
  Henry: henrySchedule,
};
