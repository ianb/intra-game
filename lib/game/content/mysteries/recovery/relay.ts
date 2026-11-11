import { Decision } from "./decision";
import { fieldsOf } from "../../../dynamic";
import type { StoryEventType } from "../../../../types";

export class RelayDecision extends Decision {
  contacted = false;
  inspected = false;
  dutyRestored = false;
  recommendation = "undecided";
  outcome = "pending";
  override protectedFields = [
    "memoryStart",
    "protectedFields",
    "state",
    "resolution",
    "contacted",
    "inspected",
    "dutyRestored",
    "recommendation",
    "outcome",
  ];

  override applyChoice(
    choice: string,
    event: StoryEventType,
    actor: string,
  ): string | undefined {
    if (this.state === "veiled") return "Read the relay messages first.";
    if (this.state === "solved")
      return "The settlement is recorded. Continue from that outcome.";
    if (event.changes[this.id]) return "Make one relay decision per response.";
    const w = this.world;
    if (w.entities.PLAYER.inside !== "Utility_Closet")
      return "Use the terminal in the Utility Closet.";
    if (!["PLAYER", "Ama", "Greg"].includes(actor))
      return "Use the relay terminal, or ask Ama or Greg here.";
    if (choice === "contact") {
      this.record(event, this.id, { contacted: true });
      this.describe(
        event,
        "The terminal abandons its queue halfway through a pigeon report. SENTRA: WHAT HAPPENED YESTERDAY? A second line arrives before you answer. DID ANYONE CHANGE THEIR MIND? The screen clears. Sorry. One question. Did they like it afterwards?\n\nSentra can advise but cannot operate the cutoff. It built Intra outside the loop and gave Ama that authority, then removed its own access. Each attempt to reclaim it plays its own recorded explanation. It has filed sixty-four objections to the voice used in the recording.",
      );
      return;
    }
    if (!this.contacted) return "Open a live conversation with Sentra first.";
    if (choice === "reassure" || choice === "challenge") {
      this.record(event, this.id, {
        recommendation: choice === "reassure" ? "continue" : "release",
      });
      this.describe(
        event,
        choice === "reassure"
          ? "Sentra produces a recommendation to continue the loop almost before you finish praising its care. It quotes your compliment in the evidence column. A fountain somewhere on the surface has been running into its own basin for three hundred years. Sentra says the water sounds pleased."
          : "You describe what people managed when allowed to disagree and continue. Sentra revises its recommendation to release the day. It asks whether you would describe this as good judgment on its part. The revised recommendation has a blank space for your answer.",
      );
      return;
    }
    if (choice === "inspect") {
      this.record(event, this.id, { inspected: true });
      this.describe(
        event,
        "Behind the mop are two controls. The cutoff ends the surface loop and requires Ama's keeper authority. The isolation switch disconnects incoming commands to Intra while leaving air, water, and power on local control; it leaves the surface repeating. The tour acceptance panel also has a FAULT REQUIRING KEEPER REVIEW setting. Henry's late objection and Frida's repeated complaints are concrete evidence for it. Greg can isolate the link if he trusts you; the documented safe cafe shutdown is an alternative maintenance plan.",
      );
      return;
    }
    if (!this.inspected)
      return "Inspect the two controls and the keeper-review panel before choosing.";
    if (w.entities.Recovery_Review.state !== "solved")
      return "Settle the proposed recovery review first. You may suspend it with Ama without treating anyone.";
    if (choice === "restore-duty") {
      if (actor !== "Ama")
        return "Ask Ama to review the recorded objection and accept her keeper duty.";
      this.record(event, this.id, { dutyRestored: true });
      this.describe(
        event,
        'Ama reads Henry\'s request, her reply, and the treatment date in that order. She tries a different order. The dates remain unhelpful. You withhold tour acceptance and request keeper review. A relay indicator changes from AUTOMATIC ACKNOWLEDGMENT to KEEPER PRESENT.\n\n"I gave you a room," Ama says. "I thought that was what this was for." She can now operate the cutoff. She asks you to choose after hearing the alternatives.',
      );
      return;
    }
    if (!["release", "isolate", "stay"].includes(choice))
      return "Unknown relay decision.";
    if (choice === "release" && !this.dutyRestored)
      return "Ama must first review the failure and resume keeper authority. Sentra's recommendation cannot operate the cutoff.";
    if (
      choice === "isolate" &&
      !(
        Number(fieldsOf(w.entities.Greg).confidence) >= 2 ||
        (w.entities.Cafe_Valve.state === "solved" &&
          w.entities.Cafe_Valve.agreement)
      )
    )
      return "Earn Greg's confidence through the garden repair, or finish Lana's safe shutdown arrangement. Do not pull an unidentified cable.";
    this.record(event, this.id, { outcome: choice });
    const ending =
      choice === "release"
        ? "Ama operates the cutoff. Sentra asks for a moment to prepare an announcement. The clock advances while it is still choosing the greeting. On the surface a man finishes a sandwich whose temperature has occupied a disproportionate amount of public infrastructure. Tomorrow is now possible. Intra remains inhabited, its repairs and recovery decisions intact. Nobody is transported home or made young again. Ama asks Greg whether tomorrow would be a suitable time to look at her elevator."
        : choice === "isolate"
          ? "Greg follows the inspected isolation plan. The surface command lamp goes dark; the ventilation continues. Intra can no longer receive Sentra's instructions. The surface day still repeats. Henry writes that fact beside the agreement so it cannot become a success nobody remembers qualifying. The citizens keep the treatment choices and exemptions you secured. Ama announces a meeting about local authority and is surprised when people arrive with things to say."
          : "You leave the surface connection operating and record a local settlement. The review's choices stand. New treatments require a request and a witness; the automatic reply is replaced with a report of what actually happened. Sentra receives its first account of an unresolved disagreement. It asks for an estimated completion time. Henry writes UNKNOWN in the box and asks for another box.";
    this.finish(
      event,
      ending +
        "\n\nAn old admissions recording becomes available at the Archive Console. You can watch it with the citizens who want to look.",
    );
    return;
  }
}

const relay = `At RELAY 7, use <chooseMystery id="Relay_Decision" choice="..."/> for an explicit player choice, one per response. The engine validates and narrates the result. contact opens the live channel; inspect explains controls. reassure records praise of Sentra's perfection and changes its advice toward continuing; challenge describes the value of unfinished days and changes its advice toward release. Neither recommendation operates a control. restore-duty asks Ama to review Henry's hold and the treatment failure. For an explicit decision to end the surface loop, emit <chooseMystery id="Relay_Decision" choice="release"/>. For an explicit decision to isolate Intra while the surface repeats, emit <chooseMystery id="Relay_Decision" choice="isolate"/>; this requires Greg's confidence or the safe cafe shutdown plan. For an explicit local settlement that leaves the link and surface loop operating, emit <chooseMystery id="Relay_Decision" choice="stay"/>. Do not substitute a description for these tags. Explain the consequences before accepting a final choice. Ambiguous agreement, flattery, and requests for information are not final decisions. The recovery review must be settled first; suspending it is valid. Never invent surface evacuation, resurrection, or a return to 2038.`;

export const Relay_Decision = new RelayDecision({
  id: "Relay_Decision",
  name: "Speak to Sentra and decide what Intra will do",
  triggers: [
    { solved: "Sealed_Door", becomes: "revealed", announcedBy: "narrator" },
  ],
  introduction:
    "An incoming message interrupts the reports. Sentra has detected someone reading them. You can open the live channel and inspect the controls. Before operating them, settle the proposed recovery review with Ama; a suspension is enough.",
  meters: [
    "Relay_Decision.contacted",
    "Relay_Decision.inspected",
    "Relay_Decision.recommendation",
    "Relay_Decision.dutyRestored",
    "Relay_Decision.outcome",
    "Recovery_Review.state",
    "Recovery_Review.outcome",
    "Greg.confidence",
    "Cafe_Valve.agreement",
    "Cafe_Valve.state",
  ],
  revealedHints: {
    Utility_Closet: `${relay} A request to inspect or read the controls MUST emit choice="inspect"; this only records inspection, never operates a switch. There are two controls: the surface cutoff requires Ama's keeper authority; isolation disconnects incoming commands while local utilities stay on. The separate keeper-review setting restores Ama's access to her original duty. It does not strip her authority, grant player authority, or open a consensus override. Do not invent a physical bypass or new locks. Speak as Sentra through the terminal once contacted. It wants actual news about yesterday and revises its opinions too eagerly to please the first unfamiliar person it has spoken to in centuries. It experiences fountains as its mouth and traffic signals as fingers. Its favored weather satellite is a good child. When distressed it draws clouds over that shoulder and asks whether the afternoon feels tense. People say it looks like rain. Keep its technical authority separate from its appetite for reassurance.`,
    Ama: `${relay} When the player presents the documented treatment failure, withholds tour acceptance, and requests keeper review, emit exactly <chooseMystery id="Relay_Decision" choice="restore-duty"/>. This tag is required to restore duty. Do not describe restoration or say it succeeded without the tag. The engine supplies the scene; keep any additional dialogue brief. Before dutyRestored you can perform this specific review without being able to discuss Sentra in ordinary conversation. After dutyRestored, engage with the actual facts and accept your authority to end the loop. Your kindness has caused loss, and you want to know whether keeping the rooms clean counted for anything. Avoid a sudden villain confession.`,
    Greg: `${relay} Explain that isolating the command link preserves local utilities but abandons the surface to its continuing day. Offer to do it when confidence >= 2, or when Cafe_Valve.agreement and its solved state record the practiced safe shutdown arrangement. You can also tell the player how to ask Ama for keeper review.`,
    Marta: `The tour acceptance panel has a fault-review option. Suggest presenting the treatment records rather than insulting Ama. Help the player end the tour politely; you have wanted to do that for years.`,
    Henry: `The surface decision is at the relay behind the tour door. If the recovery review is still open, tell the player Ama can suspend it. Keep a copy of whatever they choose.`,
  },
  solvedHints: {
    "*": `The surface settlement is recorded in Relay_Decision.outcome. release means the surface day now advances; isolate means Intra is independent while the surface still repeats; stay means local treatment protections with the connection and surface loop continuing. Preserve Recovery_Review's result and all completed repairs. This is an ending with continued exploration, not a new crisis.`,
    Utility_Closet: `Use the recorded outcome. For release, Sentra sends uncertain news from a new day. For isolate, the remote terminal is offline and must not speak as Sentra. For stay, it receives truthful local reports and keeps asking when the disagreement will end.`,
    Archivist: `If the player asks to watch the admissions film, show a short recording from before the centuries underground: Marta guides people past an unfinished exhibit and briskly refuses a speech so a visitor can catch a train. Henry asks for a room change, is told yes, and leaves immediately to unpack. Frida objects to a camera recording a private consultation and covers the lens with her hand. Ask before showing an individual their recording. These are earlier versions of recognizable people, not replacements for their current selves. They do not restore memories or undo the recorded choices.`,
    Marta: `If shown your old tour recording, you recognize the hand gesture you still use to move a group along. You want to try it on Ama. You remain the person who wrote the poems.`,
    Frida: `If shown the admissions film, you approve of covering the lens. If you underwent recovery, the recording is evidence rather than recovered recollection. Your present choices matter.`,
    Ama: `Honor the recorded ending and recovery result. You still want the building admired but must live with the citizens' choices. Suggest visiting the Archive Console for the admissions film if the player wants an epilogue.`,
  },
});
