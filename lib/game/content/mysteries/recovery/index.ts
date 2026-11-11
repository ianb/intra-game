import { Decision } from "./decision";
import { fieldsOf } from "../../../dynamic";
import type { StoryEventType } from "../../../../types";

export class RecoveryReview extends Decision {
  rosterRead = false;
  fridaChoice = "undecided";
  gregExempt = false;
  martaExempt = false;
  outcome = "pending";
  reintroduced = false;
  override protectedFields = [
    "memoryStart",
    "protectedFields",
    "state",
    "resolution",
    "rosterRead",
    "fridaChoice",
    "gregExempt",
    "martaExempt",
    "outcome",
    "reintroduced",
  ];

  override applyChoice(
    choice: string,
    event: StoryEventType,
    actor: string,
  ): string | undefined {
    if (this.state === "veiled")
      return "The recovery review has not been announced.";
    if (event.changes[this.id])
      return "Make one recovery decision per response.";
    const w = this.world;
    if (
      choice === "reintroduce" &&
      this.outcome === "recovered" &&
      !this.reintroduced
    ) {
      if (actor !== "Frida")
        return "Compare the saved letters with Frida herself.";
      this.record(event, this.id, { reintroduced: true });
      this.record(event, "Frida", {
        confidence: 2,
        attitudes: {
          PLAYER:
            "My letters say this person helped me. They showed me the letters and let me decide what to believe.",
        },
      });
      this.describe(
        event,
        'Frida checks the signatures against the way she holds her pen. "I underlined that twice. I must have been unbearable." She folds the letter into her pocket. "Thank you for keeping it. I am going to disagree with parts of it."',
      );
      return;
    }
    if (this.state === "solved")
      return "The review is closed. Its recorded outcome remains in effect.";
    if (choice === "inspect") {
      if (!["Ama", "Archivist", "PLAYER"].includes(actor))
        return "Ask Ama or inspect the Archive Console roster.";
      this.record(event, this.id, { rosterRead: true });
      this.describe(
        event,
        "The proposed review lists Henry: HOLD, Greg: CONSULT BEFORE ANY TREATMENT, Marta: CONSULT BEFORE ANY TREATMENT, Frida: DECISION REQUIRED. All other citizens are outside this review. Nobody is scheduled for automatic treatment. Frida may keep her memories or return to her archived state; the latter would remove her recent quarrel and her recollection of helping you. Her paper copies would remain. Ama has printed a space for objections narrower than the space for signatures. Henry turns the sheet sideways.",
      );
      return;
    }
    if (!this.rosterRead)
      return "Read the roster and the consequences with Ama or the Archivist first.";
    if (choice === "keep-frida" || choice === "recover-frida") {
      if (actor !== "Frida")
        return "Frida must state her own preference in conversation.";
      this.record(event, this.id, {
        fridaChoice: choice === "keep-frida" ? "keep" : "recover",
      });
      this.describe(
        event,
        choice === "keep-frida"
          ? 'Frida writes KEEP across her entry. "She will call that a symptom. Make a copy before she does."'
          : 'Frida signs a request to return to her archived state. She understands that she will forget the quarrel and her recent work with you. She gives you her copies to keep outside the procedure. "Do not tell her I was calmer before. She will put it on the invitation." This is a request, not the procedure. She can change her mind before confirmation in the Reflection Chamber.',
      );
      return;
    }
    if (choice === "exempt-greg") {
      if (
        actor !== "Greg" ||
        Number(fieldsOf(w.entities.Greg).confidence) < 2 ||
        w.entities.Cafe_Valve.state !== "solved"
      )
        return "Greg needs the repaired garden and the completed valve review before he will register his maintenance exemption.";
      this.record(event, this.id, { gregExempt: true });
      this.describe(
        event,
        'Greg lists the repairs only he can explain. Ama grants a standing maintenance exemption. He adds the chair he stands on to reach the pipe. "Also structurally important."',
      );
      return;
    }
    if (choice === "exempt-marta") {
      if (
        actor !== "Marta" ||
        Number(fieldsOf(w.entities.Marta).confidence) < 2
      )
        return "Marta will make this request with a trusted ally. Rehearse the tour privately or support her keeping the title.";
      this.record(event, this.id, { martaExempt: true });
      this.describe(
        event,
        "Marta requests a standing exemption so the award can recognize sustained achievement. Ama approves. Marta asks you to keep the unsigned copy as well. She intends to write on it.",
      );
      return;
    }
    if (choice === "pause") {
      if (actor !== "Ama") return "Ask Ama to suspend the proposed review.";
      this.record(event, this.id, { outcome: "paused" });
      this.finish(
        event,
        "Ama suspends the review. Nobody receives treatment. Henry pins the suspension beside his hold and sits where he can watch both. Future treatment requires a fresh request and a witnessed discussion. The paper is kept in the Waiting Room, where Ama cannot improve its wording without someone noticing.",
      );
      return;
    }
    if (choice !== "confirm") return "Unknown recovery decision.";
    if (actor !== "Ama" || w.entities.PLAYER.inside !== "Reflection_Chamber")
      return "Confirm the review with Ama in the Reflection Chamber after gaining tour access.";
    if (w.entities.Cafe_Valve.state !== "solved")
      return "Finish reviewing the delivered cafe valve before approving any recovery equipment.";
    if (this.fridaChoice === "undecided")
      return "Ask Frida whether she wants to keep her memories or request recovery. You can also suspend the whole review.";
    if (this.fridaChoice === "recover") {
      this.record(event, "Frida", {
        memoryStart: w.model.liveUpdates.value.filter((e) => !e.uiOnly).length,
        confidence: 0,
        attitudes: Object.fromEntries(
          Object.keys(w.entities.Frida.attitudes).map((id) => [id, null]),
        ),
        inside: "Reflection_Chamber",
      });
      this.record(event, this.id, { outcome: "recovered" });
      this.finish(
        event,
        "Frida confirms her request and sits in the chair. Ama asks whether it is comfortable. Frida says that seems beside the point. The treatment returns Frida to her archived mental state in her own living body. When she opens her eyes, she asks who you are. Henry keeps the signed request and the earlier objections. Nobody else is treated. The garden repair and the safe cafe arrangement remain in place. You can show Frida her saved letters when she is ready.",
      );
    } else {
      this.record(event, this.id, { outcome: "kept" });
      this.finish(
        event,
        "Ama closes the review without treating anyone. Frida keeps her memories. Henry retains his hold; unconsenting citizens remain excluded. The standing exemptions, if arranged, remain on file. Ama asks whether everyone could at least try the chairs.",
      );
    }
    return;
  }
}

const instructions = `Recovery is a proposed review, not a countdown. No elapsed time starts it. Read the current meters. Use <chooseMystery id="Recovery_Review" choice="..."/> for the specific decisions below, one per response. Never set its fields or resolve it directly. The engine supplies the resulting scene. Do not claim a decision succeeded before the tag. Frida is the only possible treatment recipient in this review; everyone else remains held or excluded. Never substitute a death or erase the player's memories.`;

export const Recovery_Review = new RecoveryReview({
  id: "Recovery_Review",
  name: "Review the recovery roster before anyone is treated",
  triggers: [
    {
      solved: "Recovery_Questions",
      becomes: "revealed",
      announcedBy: "narrator",
    },
  ],
  introduction:
    'Henry brings you a proposed recovery review that arrived with the old notices. "I have put my objection on top. She keeps sorting by date." Ama wants to discuss the roster. You can inspect it, secure standing exemptions, ask Frida what she wants, or have Ama suspend the whole review. No treatment begins while you investigate.',
  meters: [
    "Recovery_Review.rosterRead",
    "Recovery_Review.fridaChoice",
    "Recovery_Review.gregExempt",
    "Recovery_Review.martaExempt",
    "Recovery_Review.outcome",
    "Recovery_Review.reintroduced",
    "Cafe_Valve.state",
    "Greg.confidence",
    "Marta.confidence",
  ],
  revealedHints: {
    Ama: `${instructions} On an explicit request to read the roster use choice="inspect". On an explicit request to suspend the entire review use choice="pause"; no tour or extra favor is required. On a request to carry out the reviewed decision use choice="confirm" only in Reflection_Chamber after the cafe valve is safe and Frida has chosen. Tell the player these requirements before they pursue them. You can invite Frida to meet there for her requested treatment. You want relief to be appreciated and regard a request to keep a painful memory as a personal criticism. Honor it anyway.`,
    Archivist: `${instructions} On inspecting the proposed roster use choice="inspect". The complaint copies are stored outside recovery and remain readable afterward.`,
    Frida: `${instructions} Discuss your actual choice when the player asks. You dread reliving the public quarrel, but also fear losing the objections and the recent relationship with the player. You may request recovery when the player offers to preserve your letters and supports that wish, or choose to keep your memories when they support your refusal. Do not claim every embarrassment requires treatment. After discussing the cost, use choice="recover-frida" or choice="keep-frida" as your own explicit decision. You may reverse this before the review closes. Do not perform recovery during this conversation.`,
    Greg: `${instructions} Explain the standing exemption: after the garden and valve work, you trust the player enough to put your maintenance responsibilities on file. On their request use choice="exempt-greg". Without trust, explain what work earns it. The whole review can also be suspended without your exemption.`,
    Marta: `${instructions} Offer to request a standing exemption for continuity of exemplary service if confidence >= 2. On agreement use choice="exempt-marta". This also protects the person who writes the poems; you do not say that part to Ama. Before trust, offer the tour rehearsal and private support as ways to earn it.`,
    Henry: `Keep your existing hold visible. Offer to witness the review and preserve copies in the Waiting Room. Tell the player Ama can suspend it, or Frida can choose. No appointment timer can override your hold.`,
    Gloria: `You remember the quarrel Frida is considering forgetting. Ask the player to speak with her before authorizing anything. If they ask you to explain, describe a recognizable disagreement about Ama announcing a private complaint over breakfast, not an arbitrary breakdown.`,
    Reflection_Chamber: `${instructions} This is the review and treatment room. Ask Ama here to confirm a decision already discussed with Frida. An empty chair is not consent.`,
  },
  solvedHints: {
    Ama: `The recorded Recovery_Review.outcome controls what happened. paused or kept means nobody was treated. recovered means only Frida was restored in her living body, by request; she has forgotten recent events. All repairs, Henry's hold, and standing exemptions remain. Future recovery requires a fresh request and witness. Tell the player RELAY 7 in the Utility Closet is available through the tour. Do not announce another treatment.`,
    Frida: `If outcome is recovered and reintroduced is false, you do not remember helping the player, the quarrel, or earning their trust. Treat older quest hints as facts in documents, not personal memories. When the player shows your preserved letters and explains who they are, compare signatures and use <chooseMystery id="Recovery_Review" choice="reintroduce"/>. This rebuilds confidence from evidence, not restored memory. If reintroduced is true, remember this new conversation; earlier events remain absent. If outcome is kept or paused, you retain all memories and trust.`,
    Henry: `Keep the signed treatment choice or suspension, your hold, and Frida's letters. Help the player understand the actual outcome. Direct them toward the tour's relay equipment to ask who originally authorized Intra.`,
    Greg: `Your repairs and the safe valve arrangement persist across the review. Offer to inspect the relay isolation switch with the player once they reach the Utility Closet.`,
  },
});
