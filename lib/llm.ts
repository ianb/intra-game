import { signal } from "@preact/signals-react";
import { GeminiChatType, LlmLogType } from "./types";

export const logSignal = signal<LlmLogType[]>([]);

export async function chat(request: GeminiChatType) {
  const log = {
    request,
  };
  const lastIndex = logSignal.value.length
    ? logSignal.value[0].request.meta.index
    : 0;
  request.meta.index = lastIndex + 1;
  request.meta.start = Date.now();
  logSignal.value = [log, ...logSignal.value.slice(0, 20)];
  const response = await fetch("/api/llm", {
    method: "POST",
    body: JSON.stringify(request),
  });
  const text = (await response.json()).response;
  const newLog = {
    ...log,
    end: Date.now(),
    response: text,
  };
  logSignal.value = logSignal.value.map((l) => (l === log ? newLog : l));
  return text;
}
