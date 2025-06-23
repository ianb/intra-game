import { ModelType } from "@/components/modelselector";
import { openrouterCode } from "@/components/openrouter";
import { signal } from "@preact/signals-react";
import { persistentSignal } from "./persistentsignal";
import {
  GeminiChatType,
  GeminiHistoryType,
  GeminiModelType,
  LlmLogType,
} from "./types";

export const DEFAULT_PRO_MODEL: GeminiModelType = "gemini-1.5-pro";
export const DEFAULT_FLASH_MODEL: GeminiModelType = "gemini-1.5-flash";
export const DEFAULT_MODEL = DEFAULT_PRO_MODEL;

export const customEndpoint = persistentSignal<string | null>(
  "customEndpoint",
  null
);
export const openrouterModel = persistentSignal<ModelType | null>(
  "openrouter",
  null
);

export const logSignal = signal<LlmLogType[]>([]);

export const lastLlmError = signal<string | null>(null);

export class LlmError extends Error {
  candidates: any;

  constructor(message: string, candidates: any) {
    super(message);
    this.candidates = candidates;
  }

  describe() {
    const c = this.candidates[0];
    const lines = [`Request was rejected due to: ${c.finishReason}`];
    for (const item of c.safetyRatings) {
      if (item.probability === "NEGLIGIBLE") {
        continue;
      }
      lines.push(`  ${item.category}: prob ${item.probability}`);
    }
    return lines.join("\n");
  }
}

export class LlmSafetyError extends LlmError {}

export class LlmServiceError extends Error {
  body: any;

  constructor(message: string, body: any) {
    if (typeof message !== "string") {
      if ((message as any)?.error?.message) {
        message = (message as any).error.message;
      }
    } else {
      message = JSON.stringify(message);
    }
    super(message);
    this.body = body;
  }

  toString() {
    return JSON.stringify(this.body, null, 2);
  }
}

export async function chat(request: GeminiChatType) {
  request = upliftInstructions(request);
  request = fixText(request);
  const log = {
    request,
  };
  const lastIndex = logSignal.value.length
    ? logSignal.value[0].request.meta.index
    : 0;
  request.meta.index = (lastIndex || 0) + 1;
  request.meta.start = Date.now();
  if (!request.model) {
    request.model = DEFAULT_MODEL;
  } else if (request.model === "pro") {
    request.model = DEFAULT_PRO_MODEL;
  } else if (request.model === "flash") {
    request.model = DEFAULT_FLASH_MODEL;
  }
  logSignal.value = [log, ...logSignal.value.slice(0, 20)];
  let text = "";
  try {
    let response: Response;
    if (customEndpoint.value) {
      response = await fetch(`${customEndpoint.value}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openrouterModel.value?.id || request.model,
          messages: [
            {
              role: "system",
              content: request.systemInstruction || "",
            },
            ...request.history.map((h) => convertMessage(h)),
            {
              role: "user",
              content: request.message,
            },
          ],
        }),
      });
    } else {
      if (!openrouterModel.value) {
        throw new Error(
          "No OpenRouter model selected. Please select a model first."
        );
      }
      if (!openrouterCode.value) {
        throw new Error(
          "No OpenRouter API key found. Please connect to OpenRouter first."
        );
      }
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Title": "Intra",
          "HTTP-Referer": location.origin,
          Authorization: `Bearer ${openrouterCode.value}`,
        },
        body: JSON.stringify({
          model: openrouterModel.value.id,
          messages: [
            {
              role: "system",
              content: request.systemInstruction || "",
            },
            ...request.history.map((h) => convertMessage(h)),
            {
              role: "user",
              content: request.message,
            },
          ],
        }),
      });
    }
    if (!response.ok) {
      lastLlmError.value = `LLM service error ${response.status}: ${response.url}`;
      throw new Error(`HTTP ${response.status}: ${response.url}`);
    }
    const json = await response.json();
    if (json.error) {
      let msg: any = json.error?.message;
      if (msg && typeof msg === "string") {
        try {
          msg = JSON.parse(msg);
        } catch (_e) {}
      }
      if (!msg) {
        if (typeof json.error === "string") {
          msg = json.error;
        } else {
          msg = JSON.stringify(json.error);
        }
      }
      if (typeof json.error === "object") {
        json.error.message = msg;
      }
      lastLlmError.value = `${msg?.message || msg}`;
      throw new LlmServiceError(msg?.message || msg, json.error);
    }
    if (!json.choices || !json.choices[0]?.message?.content) {
      console.error("Bad Response", json);
      lastLlmError.value = `Bad response from LLM: no content in choices`;
      throw new Error("Bad response from LLM: no content in choices");
    }
    text = json.choices[0].message.content;
  } catch (e) {
    const newLog = {
      ...log,
      end: Date.now(),
      errorMessage: `${e}`,
    };
    logSignal.value = logSignal.value.map((l) => (l === log ? newLog : l));
    lastLlmError.value = `Unexpected LLM error: ${e}`;
    throw e;
  }
  const newLog = {
    ...log,
    end: Date.now(),
    response: text,
  };
  logSignal.value = logSignal.value.map((l) => (l === log ? newLog : l));
  return text as string;
}

function fixText(request: GeminiChatType) {
  request.history = request.history.map((h) => {
    if (h.text) {
      return {
        role: h.role,
        parts: [{ text: h.text }],
      };
    }
    return h;
  });
  return request;
}

function convertMessage(h: GeminiHistoryType): {
  role: "user" | "assistant";
  content: string;
} {
  let text = h.text;
  if (h.parts) {
    text = h.parts.map((p) => p.text).join("\n");
  }
  return {
    role: h.role === "user" ? "user" : "assistant",
    content: text || "",
  };
}

function upliftInstructions(chat: GeminiChatType): GeminiChatType {
  const system = chat.systemInstruction || "";
  const newChat = { ...chat };
  // if (/<insert-system\s*\/?>/i.test(system)) {
  //   // FIXME: should warn if are instructions but no <insert-system/>
  //   return chat;
  // }
  const allInstructions = [];
  const { repl, instructions } = parseInstructions(system);
  newChat.systemInstruction = repl;
  allInstructions.push(...instructions);
  newChat.history = newChat.history.map((history) => {
    const { repl, instructions } = parseInstructions(makeText(history));
    allInstructions.push(...instructions);
    return replText(history, repl);
  });
  const { repl: messageRepl, instructions: messageInstructions } =
    parseInstructions(chat.message);
  newChat.message = messageRepl;
  allInstructions.push(...messageInstructions);
  if (
    allInstructions.length > 0 &&
    !/<insert-system\s*\/>/i.test(newChat.systemInstruction)
  ) {
    throw new Error("Instructions were not inserted into system instruction");
  }
  const newSystem = newChat.systemInstruction.replace(
    /<insert-system\s*\/>/i,
    allInstructions.join("\n")
  );
  newChat.systemInstruction = newSystem;
  return newChat;
}

function parseInstructions(system: string): {
  repl: string;
  instructions: string[];
} {
  const instructions: string[] = [];
  const instructionRegex = /<system>([^]*?)<\/system>\s*/gi;
  const repl = system.replace(instructionRegex, (match, contents) => {
    instructions.push(contents.trim());
    return "";
  });
  return { repl, instructions };
}
function makeText(history: GeminiHistoryType): string {
  if (history.parts) {
    return history.parts.map((x) => x.text).join("");
  }
  return history.text || "";
}

function replText(history: GeminiHistoryType, text: string): GeminiHistoryType {
  if (history.parts) {
    history = { ...history };
    delete history.parts;
  }
  return { ...history, text };
}
