import { logSignal } from "@/lib/llm";
import { GeminiChatType, LlmLogType } from "@/lib/types";
import { useSignal } from "@preact/signals-react";
import { useEffect } from "react";

export default function LlmLog() {
  return (
    <div className="text-xs">
      {logSignal.value.map((log, index) => (
        <div key={index} className="border-b border-gray-700 p-2">
          <div className="bg-blue-900 text-white p-1">
            #{log.request.meta.index} {log.request.meta.title}{" "}
            <RequestTime start={log.request.meta.start!} end={log.end} />
            {log.request.model === "gemini-1.5-flash" && " ⚡"}
          </div>
          <LlmError log={log} />
          <LlmRequest
            request={log.request}
            finished={!!log.response || !!log.errorMessage}
          />
          <LlmResponse response={log.response} />
        </div>
      ))}
    </div>
  );
}

function LlmError({ log }: { log: LlmLogType }) {
  if (!log.errorMessage) {
    return null;
  }
  return (
    <pre className="whitespace-pre-wrap text-white bg-red-900 -indent-2 pl-2">
      <strong>error:</strong> {log.errorMessage}
    </pre>
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
    <div className={finished ? "" : "bg-blue-950"}>
      {request.systemInstruction && (
        <LlmRequestItem role="system" text={request.systemInstruction} />
      )}
      {request.history.map((history, index) => (
        <LlmRequestItem
          role={history.role}
          text={history.parts!.map((part) => part.text).join(" ")}
        />
      ))}
      <LlmRequestItem role="user" text={request.message} />
    </div>
  );
}

function LlmRequestItem({ role, text }: { role: string; text: string }) {
  return (
    <pre className="whitespace-pre-wrap -indent-2 pl-2 mb-2">
      <strong>{role}:</strong> {text}
    </pre>
  );
}

function LlmResponse({ response }: { response?: string }) {
  if (!response) {
    return null;
  }
  return (
    <pre className="whitespace-pre-wrap text-white bg-green-900 -indent-2 pl-2">
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
