import { logSignal } from "@/lib/llm";
import { GeminiChatType } from "@/lib/types";
import { useSignal } from "@preact/signals-react";
import { useEffect } from "react";

export default function LlmLog() {
  return (
    <div>
      {logSignal.value.map((log, index) => (
        <div key={index} className="border-b border-gray-700 p-2">
          <div>
            #{log.request.meta.index} {log.request.meta.title}{" "}
            <RequestTime start={log.request.meta.start!} end={log.end} />
            {log.request.model === "gemini-1.5-flash" && " ⚡"}
          </div>
          <LlmRequest request={log.request} finished={!!log.response} />
          <LlmResponse response={log.response} />
        </div>
      ))}
    </div>
  );
}

function LlmRequest({
  request,
  finished,
}: {
  request: GeminiChatType;
  finished: boolean;
}) {
  return (
    <div className={finished ? "bg-blue-900" : ""}>
      {request.history.map((history, index) => (
        <pre className="whitespace-pre-wrap" key={index}>
          <strong>{history.role}:</strong>{" "}
          {history.parts!.map((part) => part.text).join(" ")}
        </pre>
      ))}
      <pre className="whitespace-pre-wrap">
        <strong>user:</strong> {request.message}
      </pre>
    </div>
  );
}

function LlmResponse({ response }: { response?: string }) {
  if (!response) {
    return null;
  }
  return (
    <pre className="whitespace-pre-wrap bg-green-900">
      <strong>model:</strong> {response}
    </pre>
  );
}

function RequestTime({ start, end }: { start: number; end?: number }) {
  if (end) {
    return <span>{timeElapsed(end - start)}</span>;
  }
  return <RequestCountdown start={start} />;
}

function RequestCountdown({ start }: { start: number }) {
  const elapsed = useSignal(Date.now() - start);
  useEffect(() => {
    const interval = setInterval(() => {
      elapsed.value = Date.now() - start;
    }, 1000);
    return () => clearInterval(interval);
  });
  return <span>{timeElapsed(elapsed.value)}</span>;
}

function timeElapsed(ms: number) {
  /* Return 'm:ss' */
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secondsPadded = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secondsPadded}`;
}
