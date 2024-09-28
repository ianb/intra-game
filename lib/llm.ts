import { GeminiChatType } from "./types";

export async function chat(request: GeminiChatType) {
  const response = await fetch("/api/llm", {
    method: "POST",
    body: JSON.stringify(request),
  });
  const resp = await response.json();
  return resp.response;
}
