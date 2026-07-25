// Shared scenario definitions so the recorder and the replay tests agree on the
// exact seed + input sequence. Change any of these and you must re-record the
// cassette (pnpm playtest:record).
export type Scenario = {
  name: string;
  seed: number;
  cassette: string;
  inputs: string[];
};

export const INTAKE: Scenario = {
  name: "intake",
  seed: 20260725,
  cassette: "playtest/cassettes/intake.json",
  inputs: [
    "Hello? Where am I?",
    "My name is Ada Quill.",
    "I used to be a data analyst.",
    "look around the room",
  ],
};

export const SCENARIOS: Scenario[] = [INTAKE];
