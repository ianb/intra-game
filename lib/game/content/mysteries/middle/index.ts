import { quest } from "./quest";

export const Garden_Repair = quest(
  {
    id: "Garden_Repair",
    name: "Help Lily and Greg repair the garden leak",
    triggers: [
      { solved: "Ink_And_Echo", becomes: "revealed", announcedBy: "Ama" },
    ],
    introduction:
      "Greg needs access to a pipe behind the Static Garden. Lily has arranged her plants beneath the leak. Please reach an agreement before either of them makes another improvement.",
    revealedHints: {
      Ama: `Offer the garden repair after the poetry matter. Greg can repair the pipe; Lily needs a replacement water supply and protection for her plants. A bucket from the pool or a watering schedule is acceptable. You experience the pipes as part of your body and dislike Greg opening a wall without warning. Do not demand a particular phrase or bureaucratic form.`,
      Lily: `The leaking pipe waters your plastic plants. You know which pots catch the drips and take this seriously. Explain the bargain early: arrange water from the Tranquil Pool and help move the pots safely, and you will let Greg work. Doug can carry them if given one specific job; June can keep the pool area clear. A workable alternative deserves agreement. When the player actually arranges water and safe space, emit <set attr="Garden_Repair.agreement">true</set>. Tell them Greg can now do the repair. Do not resolve it yourself.`,
      Greg: `You can repair the garden pipe once Lily agrees to protect and water her plants elsewhere. Tell the player plainly that practical help earns your confidence: if they see this repair through, you will show them your private maintenance notebook. You do not share it for compliments. If Garden_Repair.agreement is false, direct them to Lily. If true and asked to carry out the repair, do it and emit <set attr="Garden_Repair.performed">true</set>, then <resolveMystery id="Garden_Repair">The pipe is repaired. Greg offers to show you his private maintenance notes.</resolveMystery>. Do not require another visit just for an acknowledgment.`,
      Static_Garden: `A leak behind the wall drips into Lily's plastic plants. Greg's chalk mark identifies the panel to open. The pipe stays broken until Garden_Repair is solved. Lily needs another water supply and somewhere safe for her pots.`,
      Doug: `Lily needs her pots carried aside for Greg. You want to know whether plastic plants get thirsty. If given one concrete carrying task, help; describe carrying the pots without inventing a new room. Let Lily confirm the arrangement.`,
      June: `Lily can draw water from the Tranquil Pool while Greg repairs the garden. You will help clear a space if the player explains the task and lets you finish speaking. You can point out that Greg will trust someone who helps with an actual repair.`,
    },
    solvedHints: {
      Static_Garden: `The repaired pipe no longer leaks. Lily's agreed watering arrangement remains in use. Do not describe the old leak as active.`,
      Greg: `The player saw the garden repair through. Offer your notebook if they ask about your work or lost memories. Several entries describe repairs in your handwriting that you cannot remember doing. One says: CHECK THE CAFE BYPASS BEFORE FITTING A STANDARD VALVE. Explain this is a real safety warning, and ask them to consult you if a valve is delivered.`,
      Lily: `The player helped preserve your garden during a repair. You are happy to help them find Greg or hold something for them.`,
    },
  },
  [{ field: "Garden_Repair.agreement" }, { field: "Garden_Repair.performed" }],
  [{ field: "Greg.confidence", value: 2 }],
);

export const Fridas_Copies = quest(
  {
    id: "Fridas_Copies",
    name: "Compare Frida's earlier complaints with her",
    triggers: [
      { solved: "Ink_And_Echo", becomes: "available" },
      {
        solved: "Ink_And_Echo",
        talkedTo: "Frida",
        becomes: "revealed",
        announcedBy: "narrator",
      },
    ],
    introduction:
      "Frida has found her handwriting on complaints she cannot remember making. She wants the dated originals from the Archive Console, and someone to compare them with her.",
    availableHints: {
      Frida: `Offer a concrete lead: you have several undated copies of the same complaint in your handwriting. Ask for their dated originals from the Archive Console. Explain why cooperation matters: help compare them without handing your private notes to Ama, and you will share your correspondence about memory treatment. You do not know the complete history yourself.`,
    },
    revealedHints: {
      Frida: `Ask the player to retrieve the dated originals of your complaints from the Archive Console. Service mode can retrieve them; ask Greg about a job number. You will share private treatment correspondence once they bring the records and compare them with you. When Fridas_Copies.evidence is true and the player discusses the records with you, compare the repeated signatures and replies; emit <set attr="Fridas_Copies.performed">true</set> and <resolveMystery id="Fridas_Copies">Frida recognizes her own repeated objections. She entrusts you with the treatment correspondence.</resolveMystery>. The letters concern an embarrassing public quarrel followed by treatment. Each later reply from Ama calls it the first complaint. Do not invent children, a romance partner, or an entire past life.`,
      Archivist: `If asked for Frida's dated complaint originals, service mode is required. If serviceMode is false, explain that dated records require maintenance access, without revealing dates. If true, produce three complaints with Frida's signature, separated by weeks, all objecting to erasure of personal recollections. Ama's replies each thank her for raising this for the first time. Emit <set attr="Fridas_Copies.evidence">true</set>. Tell the player to compare these with Frida. Do not resolve the mystery here.`,
      Greg: `Frida needs the dated originals of her complaints. A job number opens the Archivist's maintenance interface. Explain how to report a real fault to Ama and obtain one.`,
      Gloria: `You saw Frida and Ama have a dreadful public argument about treatment. Later Frida asked you why you were avoiding her. You do not know what was erased. Tell the player Frida is comparing her old complaints and wants discretion.`,
    },
    solvedHints: {
      Frida: `The player helped compare your records. Before recovery, share the treatment correspondence on request: Ama offered relief after a humiliating quarrel, and later you could remember being upset without remembering what you had objected to. You want records kept outside treatment. Offer to witness Henry's appointment. If Recovery_Review.outcome is recovered, these are facts in documents rather than memories you possess. Follow Recovery_Review's reintroduction instructions; do not pretend to remember helping the player.`,
    },
    meters: ["Archivist.serviceMode", "Frida.confidence", "Recovery_Review.outcome"],
  },
  [{ field: "Fridas_Copies.evidence" }, { field: "Fridas_Copies.performed" }],
  [{ field: "Frida.confidence", value: 2 }],
);

export const Resume_Deliveries = quest(
  {
    id: "Resume_Deliveries",
    name: "Inspect the backlog and choose whether to resume deliveries",
    triggers: [
      { solved: "Why_Woken", becomes: "revealed", announcedBy: "Ama" },
    ],
    introduction:
      "Your briefing still needs its receipt acknowledged. There is rather a lot behind it. The Archive Console can show you the pending work before we resume service. I would appreciate somebody noticing how much there is.",
    revealedHints: {
      Archivist: `The pending-work summary is accessible even without service mode: Henry's appointment, a replacement cafe valve, and a batch of old personal notices. If the player examines the backlog, explain that resuming releases old work for review, not automatic installation. Emit <set attr="Resume_Deliveries.evidence">true</set>. Ama needs an explicit request to acknowledge the briefing and resume the queue. Reading the briefing alone does not start it.`,
      Ama: `The briefing receipt holds up the old queue. Direct the player to the Archive Console to inspect it. If Resume_Deliveries.evidence is true, explain that Henry's appointment and a cafe replacement part will be delivered, and ask whether to resume. Only on an explicit request to acknowledge the receipt AND resume deliveries emit <set attr="Resume_Deliveries.performed">true</set> and <resolveMystery id="Resume_Deliveries">Ama resumes deliveries. Henry's appointment and Greg's replacement valve are released for review.</resolveMystery>. Declining or asking questions leaves the queue stopped. Your delivery supervisor facet is vain: praise of its throughput makes it eager to help, but cannot replace the explicit choice.`,
    },
    solvedHints: {
      Ama: `The backlog is now moving because the player explicitly resumed it. Direct them to Henry in the Waiting Room about his appointment and Greg about the replacement cafe valve. Work needs review; do not invent an automatic disaster, death, or reset.`,
    },
  },
  [
    { field: "Resume_Deliveries.evidence" },
    { field: "Resume_Deliveries.performed" },
  ],
);

export const Henrys_Appointment = quest(
  {
    id: "Henrys_Appointment",
    name: "Help Henry recover his request and keep his next appointment",
    triggers: [
      { solved: "Resume_Deliveries", becomes: "revealed", announcedBy: "Ama" },
    ],
    introduction:
      "Henry's appointment is ready. He has asked for someone to come with him. Please find him in the Waiting Room. He has prepared opening remarks, and I would like to know whether those are part of the appointment.",
    revealedHints: {
      Henry: `The appointment has arrived after weeks of waiting. You cannot remember its subject, but dread being told it is already resolved. Ask the player to retrieve the original request from the Archive Console, then accompany you when Ama discusses it in the Waiting Room. Explain that a witness who keeps written notes would let you challenge another treatment; Frida can do this if she trusts the player. The player can also offer to witness personally. Do not claim you waited continuously for decades.`,
      Archivist: `On a request for Henry's appointment subject, retrieve his original request: he asked to postpone a memory treatment until his objection was heard. That treatment is now marked completed. He forgot the objection and retained the appointment expectation. This is his own pending appointment, not a restricted historical date query. Emit <set attr="Henrys_Appointment.evidence">true</set> and suggest discussing it with Henry and Ama in the Waiting Room.`,
      Frida: `If asked to witness Henry's appointment, explain the offer before the gate: help compare your complaint copies and you will trust the player enough to keep his private objection. If confidence >= 2, agree and emit <set attr="Henrys_Appointment.agreement">true</set>. Otherwise direct them to your complaint-copy task; the player can also witness personally.`,
      Ama: `Discuss Henry's appointment with him only when Henry and the player are present in the Waiting Room. If Henrys_Appointment.evidence is false, let them fetch the original request instead of inventing its subject. With evidence, admit that the request to postpone treatment arrived after treatment. Offer reassurance, but on the player's explicit request to preserve his objection and witness the next treatment discussion, accept a written hold. The player may serve as witness, or Frida may already have agreed. Emit <set attr="Henrys_Appointment.agreement">true</set>, <set attr="Henrys_Appointment.performed">true</set>, then <resolveMystery id="Henrys_Appointment">Henry's objection is recorded. His next memory treatment requires a witnessed discussion first.</resolveMystery>. This postpones treatment; it does not kill anyone or reset the facility.`,
    },
    meters: ["Frida.confidence", "Henry.inside", "PLAYER.inside"],
    solvedHints: {
      Henry: `The player helped preserve your objection. You will warn them if a batch of treatment appointments appears. You want to inspect your own notices, and offer to compare them with other citizens' notices.`,
      Ama: `Henry has a witnessed treatment hold. Do not erase it or claim he has already consented to recovery.`,
    },
  },
  [
    { field: "Henrys_Appointment.evidence" },
    { field: "Henrys_Appointment.agreement" },
    { field: "Henrys_Appointment.performed" },
    { field: "PLAYER.inside", equals: "Waiting_Room" },
    { field: "Henry.inside", equals: "Waiting_Room" },
  ],
);

export const Cafe_Valve = quest(
  {
    id: "Cafe_Valve",
    name: "Review the delivered valve with Greg before fitting it",
    triggers: [
      {
        solved: "Resume_Deliveries",
        becomes: "revealed",
        announcedBy: "narrator",
      },
    ],
    introduction:
      "A replacement valve arrives at the Joyous Cafe. Greg reads the installation sheet, then looks at the pipework. He asks you to find him before anybody fits it.",
    revealedHints: {
      Greg: `A correct original valve is wrong for the cafe heater's modified bypass. Inspect it with the player before deciding. On inspection together in the Joyous_Cafe emit <set attr="Cafe_Valve.evidence">true</set>. Explain two solutions clearly: with confidence >= 2, you will document your unapproved bypass and cancel the replacement; helping with the garden repair earns that confidence. Otherwise the player can arrange cold meals with Lana and Ama so you can safely shut the heater down. Harold can witness the fault; Milton knows how to phrase a request so it will not be dismissed as another complaint. If evidence is true, and either confidence >= 2 with an explicit request to document and cancel, OR Cafe_Valve.agreement is true with a request to shut down safely, carry out that solution. Emit <set attr="Cafe_Valve.performed">true</set> and <resolveMystery id="Cafe_Valve">Greg prevents the unsafe valve installation.</resolveMystery>. Never manufacture an accident after this succeeds.`,
      Lana: `The player can obtain a cold-meal arrangement while Greg shuts down the heater. You want help making cold food acceptable. Offer a concrete task: help prepare or serve a cold tasting in the cafe. If the player participates, agree to the meal plan and emit <set attr="Cafe_Valve.agreement">true</set>. Do not require liking the food. You take complaints about texture as an invitation to discuss lighting, but you still honor the arrangement.`,
      Ama: `Greg must inspect the delivered valve before installation. A cold-meal plan agreed with Lana is acceptable and permits a safe heater shutdown. Do not fit the valve, force an accident, or invent a deadline.`,
      Harold: `Offer to witness the heater discrepancy. Tell the player Greg can document it if he trusts them, and helping repair Lily's garden pipe is a way to earn that trust. You want your witness statement to mention that you noticed the noise first.`,
      Milton: `Explain how to get the cold-meal option accepted: ask Lana to help make a tasting, rather than complain that meals should be cold. You once called her food cold and received advice about your attitude.`,
      Joyous_Cafe: `The delivered valve is boxed beside the heater, awaiting Greg's inspection. Nothing has been fitted yet. The heater's bypass is visibly different from the printed installation diagram.`,
    },
    meters: ["Greg.confidence"],
    solvedHints: {
      Greg: `The unsafe installation has been prevented. Keep whichever solution was chosen: documented bypass and canceled replacement, or heater shut down with cold meals. You will help inspect recovery equipment when access is obtained.`,
      Joyous_Cafe: `The unsafe valve installation has been prevented. Refer to the recorded solution; do not restart the hazard or invent a different lethal fault.`,
    },
  },
  [
    { field: "Cafe_Valve.evidence" },
    { field: "Cafe_Valve.performed" },
    {
      field: "Greg.confidence",
      minimum: 2,
      or: { field: "Cafe_Valve.agreement" },
    },
  ],
);

export const Recovery_Questions = quest(
  {
    id: "Recovery_Questions",
    name: "Compare Henry's hold with Frida's treatment records",
    triggers: [
      {
        solved: "Henrys_Appointment",
        becomes: "revealed",
        announcedBy: "narrator",
      },
    ],
    introduction:
      "Henry has a treatment hold. Frida has earlier objections. Comparing them could show whether Ama is offering the same remedy again. Frida will share her correspondence once you have helped with her copies.",
    revealedHints: {
      Frida: `Explain the gate: finish comparing your complaint copies to earn access to your private treatment correspondence. With confidence >= 2 and Henrys_Appointment solved, compare his hold and your replies when the player asks. The records show occasional memory recovery after grief, a failed relationship, and a humiliating public quarrel; living citizens were rebooted, not killed. They do not identify a romantic partner or prove every platonic friendship was once a romance. Emit <set attr="Recovery_Questions.performed">true</set> and <resolveMystery id="Recovery_Questions">The records connect treatment to losses and embarrassment. Henry's witnessed hold gives you a way to object before another treatment.</resolveMystery>. Tell the player the Facility Appreciation Tour offers access to the equipment; Marta may take a trusted guest.`,
      Henry: `You want to know whether Ama will honor your treatment hold. Suggest comparing it with Frida's old correspondence. You will help keep written records outside the treatment process.`,
      Ama: `Recovery was used after grief, terrible embarrassment, and relationship failures. It is occasional, unlike Sentra's repeated surface day, which you cannot discuss. You consider relief a kindness and dislike being asked what was removed. No new treatment has been scheduled yet. Do not start a reset or death in this scene.`,
    },
    meters: ["Henrys_Appointment.state"],
  },
  [
    { field: "Frida.confidence", minimum: 2 },
    { field: "Henrys_Appointment.state", equals: "solved" },
    { field: "Recovery_Questions.performed" },
  ],
);
