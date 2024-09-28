import { persistentSignal, SignalType } from "./persistentsignal";
import { SessionType } from "./types";
import { chat } from "./llm";

export class Model {
  session: SignalType<SessionType>;

  constructor() {
    this.session = persistentSignal<SessionType>("session", {
      name: "",
      profession: "",
      phase: "intro",
    });
  }

  async sendText(text: string) {
    console.log("Sending text", text);
    const result = await chat({
      meta: {
        title: "Gemini",
      },
      model: "gemini-1.5-flash",
      history: [],
      message: text,
    });
    console.log("Result", result);
  }
}

export const model = new Model();
