import { signal } from "@preact/signals-react";
import {
  GeminiChatType,
  GeminiHistoryType,
  GeminiModelType,
  LlmLogType,
} from "./types";
import OpenAI from "openai";
import { ModelType } from "@/components/modelselector";
import { persistentSignal } from "./persistentsignal";
import { openrouterCode } from "@/components/openrouter";

// export const DEFAULT_PRO_MODEL: GeminiModelType = "gemini-1.5-pro-exp-0827";
// export const DEFAULT_FLASH_MODEL: GeminiModelType = "gemini-1.5-flash-exp-0827";
export const DEFAULT_PRO_MODEL: GeminiModelType = "gemini-1.5-pro";
export const DEFAULT_FLASH_MODEL: GeminiModelType = "gemini-1.5-flash";
// export const DEFAULT_MODEL = DEFAULT_FLASH_MODEL;
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
        body: JSON.stringify(convertRequest(request)),
      });
    } else if (process.env.NEXT_PUBLIC_USE_OPENAI) {
      response = await fetch("/api/llm?openai=1", {
        method: "POST",
        body: JSON.stringify(convertRequest(request)),
      });
    } else if (openrouterModel.value && !openrouterCode.value) {
      response = await fetch("/api/llm?openrouter=1", {
        method: "POST",
        body: JSON.stringify({
          ...convertRequest(request),
          model: openrouterModel.value.id,
          key: openrouterCode.value,
        }),
      });
    } else if (openrouterModel.value && openrouterCode.value) {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "X-Title": "Intra",
          "HTTP-Referer": location.origin,
          Authorization: `Bearer ${openrouterCode.value}`,
        },
        body: JSON.stringify({
          ...convertRequest(request),
          model: openrouterModel.value.id,
        }),
      });
    } else {
      response = await fetch("/api/llm", {
        method: "POST",
        body: JSON.stringify(request),
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
        } catch (e) {}
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
    if (!json.response && json.candidates && !json.choices) {
      console.error("Bad Response", json);
      if (json.candidates[0].finishReason === "SAFETY") {
        throw new LlmSafetyError("Safety Issue", json.candidates);
      }
      lastLlmError.value = `Bad response: ${json?.candidates?.[0]?.finishReason || "unknown"}`;
      throw new LlmError("Bad Response", json.candidates);
    }
    if (json.choices) {
      text = json.choices[0].message.content;
    } else {
      text = json.response;
    }
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

function convertRequest(
  request: GeminiChatType
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  return {
    model: "gpt-4o-mini", // request.model || DEFAULT_MODEL,
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
  };
}

function convertMessage(
  h: GeminiHistoryType
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
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
