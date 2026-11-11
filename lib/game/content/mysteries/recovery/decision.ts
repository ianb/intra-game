import { Mystery } from "../../../classes";
import { fieldsOf } from "../../../dynamic";
import type { StoryEventType } from "../../../../types";

/** Decision effects are part of the accepting event, including on reload/undo. */
export class Decision extends Mystery {
  override resolutionBlocker(): string {
    return "Use the offered chooseMystery decision; this outcome cannot be set directly.";
  }

  record(event: StoryEventType, id: string, values: Record<string, unknown>) {
    const entity = this.world.getEntity(id)!;
    const change = (event.changes[id] ??= { before: {}, after: {} });
    for (const [key, value] of Object.entries(values)) {
      if (!(key in change.before)) change.before[key] = fieldsOf(entity)[key];
      change.after[key] = value;
    }
  }

  describe(event: StoryEventType, text: string) {
    event.actions.push({ type: "description", text });
  }

  finish(event: StoryEventType, resolution: string) {
    this.record(event, this.id, { state: "solved", resolution });
    this.describe(event, resolution);
  }
}
