import { signal } from "@preact/signals-react";
import {
  GeminiChatType,
  GeminiHistoryType,
  GeminiModelType,
  LlmLogType,
} from "./types";
import OpenAI from "openai";
import { DEFAULT_CIPHERS } from "tls";

// export const DEFAULT_PRO_MODEL: GeminiModelType = "gemini-1.5-pro-exp-0827";
// export const DEFAULT_FLASH_MODEL: GeminiModelType = "gemini-1.5-flash-exp-0827";
export const DEFAULT_PRO_MODEL: GeminiModelType = "gemini-1.5-pro";
export const DEFAULT_FLASH_MODEL: GeminiModelType = "gemini-1.5-flash";
// export const DEFAULT_MODEL = DEFAULT_FLASH_MODEL;
export const DEFAULT_MODEL = DEFAULT_PRO_MODEL;

export const logSignal = signal<LlmLogType[]>([]);

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

export async function chat(request: GeminiChatType) {
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
    const response = await fetch("/api/llm?openai=1", {
      method: "POST",
      body: JSON.stringify(convertRequest(request)),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    if (!json.response && json.candidates) {
      console.error("Bad Response", json);
      if (json.candidates[0].finishReason === "SAFETY") {
        throw new LlmSafetyError("Safety Issue", json.candidates);
      }
      throw new LlmError("Bad Response", json.candidates);
    }
    text = json.response;
  } catch (e) {
    const newLog = {
      ...log,
      end: Date.now(),
      errorMessage: `${e}`,
    };
    logSignal.value = logSignal.value.map((l) => (l === log ? newLog : l));
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
