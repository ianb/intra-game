import { signal } from "@preact/signals-react";
import { GeminiChatType, GeminiModelType, LlmLogType } from "./types";

// export const DEFAULT_PRO_MODEL: GeminiModelType = "gemini-1.5-pro-exp-0827";
// export const DEFAULT_FLASH_MODEL: GeminiModelType = "gemini-1.5-flash-exp-0827";
export const DEFAULT_PRO_MODEL: GeminiModelType = "gemini-1.5-pro";
export const DEFAULT_FLASH_MODEL: GeminiModelType = "gemini-1.5-flash";

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
  if (!request.model || request.model === "pro") {
    request.model = DEFAULT_PRO_MODEL;
  } else if (request.model === "flash") {
    request.model = DEFAULT_FLASH_MODEL;
  }
  logSignal.value = [log, ...logSignal.value.slice(0, 20)];
  let text = "";
  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      body: JSON.stringify(request),
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
