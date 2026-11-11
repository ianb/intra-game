import { Mystery } from "../../../classes";
import { fieldsOf } from "../../../dynamic";
import type { ActionRequestType, StoryEventType } from "../../../../types";

interface Requirement {
  field: string;
  minimum?: number;
  equals?: unknown;
  or?: Requirement;
}
interface Reward {
  field: string;
  value: boolean | number | string;
}

/** The model recognizes actions; the engine checks prerequisites and pays rewards. */
export class MiddleQuest extends Mystery {
  requirements: Requirement[] = [];
  rewards: Reward[] = [];
  rewarded = false;
  evidence = false;
  agreement = false;
  performed = false;

  private meets(requirement: Requirement, event: StoryEventType): boolean {
    const [id = "", attr = ""] = requirement.field.split(".");
    const entity = this.world.getEntity(id);
    const value =
      event.changes[id]?.after?.[attr] ??
      (entity ? fieldsOf(entity)[attr] : undefined);
    const met =
      requirement.minimum !== undefined
        ? Number(value ?? 0) >= requirement.minimum
        : value === (requirement.equals ?? true);
    return met || Boolean(requirement.or && this.meets(requirement.or, event));
  }

  override resolutionBlocker(event: StoryEventType): string | undefined {
    if (this.state === "veiled")
      return `${this.name} has not become available.`;
    for (const requirement of this.requirements) {
      if (!this.meets(requirement, event))
        return `${this.name}: still requires ${requirement.field}${requirement.or ? ` or ${requirement.or.field}` : ""}. Explain the unfinished step to the player; do not claim success.`;
    }
    return undefined;
  }

  override onStoryEvent(event: StoryEventType): ActionRequestType[] {
    if (this.rewarded || event.changes[this.id]?.after?.state !== "solved")
      return [];
    const changes: StoryEventType["changes"] = (this as MiddleQuest).changes({
      rewarded: true,
    });
    for (const reward of this.rewards) {
      const [id = "", attr = ""] = reward.field.split(".");
      const entity = this.world.getEntity(id)!;
      changes[id] ??= { before: {}, after: {} };
      changes[id].before[attr] = fieldsOf(entity)[attr];
      changes[id].after[attr] = reward.value;
    }
    return [
      {
        id: "narrator",
        roomId: this.world.entities.PLAYER.inside,
        totalTime: 0,
        changes,
        actions: [],
      },
    ];
  }
}

export function quest(
  options: ConstructorParameters<typeof Mystery>[0],
  requirements: Requirement[],
  rewards: Reward[] = [],
): MiddleQuest {
  const result = new MiddleQuest(options);
  result.requirements = requirements;
  result.rewards = rewards;
  result.meters = [
    ...new Set([
      ...(options.meters ?? []),
      ...requirements.map((r) => r.field),
    ]),
  ];
  return result;
}
