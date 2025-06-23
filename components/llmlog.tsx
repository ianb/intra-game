import { logSignal } from "@/lib/llm";
import { ChatType, LlmLogType } from "@/lib/types";
import { useSignal } from "@preact/signals-react";
import { forwardRef, useEffect, useRef } from "react";

export default function LlmLog() {
  return (
    <div className="text-xs">
      {logSignal.value.map((log, i) => (
        <LogItem log={log} first={i === 0} key={log.request.meta.index} />
      ))}
    </div>
  );
}

function LogItem({ log, first }: { log: LlmLogType; first: boolean }) {
  const responseRef = useRef<HTMLPreElement>(null);
  const hide = useSignal<boolean | null>(null);
  const actuallyHide = hide.value === null ? !first : hide.value;
  return (
    <div className="border-b border-gray-700 p-2">
      {log.response && (
        <div
          className="float-right cursor-pointer opacity-75 hover:opacity-100 hover:bg-blue-600 px-3"
          onClick={() => {
            if (responseRef.current) {
              hide.value = false;
              responseRef.current.scrollIntoView({ behavior: "smooth" });
            } else if (hide.value || hide.value === null) {
              hide.value = false;
              setTimeout(() => {
                if (responseRef.current) {
                  responseRef.current.scrollIntoView({ behavior: "smooth" });
                }
              }, 100);
            }
          }}
        >
          ↓
        </div>
      )}
      <div
        className="bg-blue-900 text-white p-1 cursor-default"
        onClick={() => {
          hide.value = !actuallyHide;
        }}
      >
        #{log.request.meta.index} {log.request.meta.title}{" "}
        <RequestTime start={log.request.meta.start!} end={log.end} />
        {log.request.model === "flash" && " ⚡"}
      </div>
      <LlmError log={log} />
      {!actuallyHide && (
        <>
          <LlmRequest
            request={log.request}
            finished={!!log.response || !!log.errorMessage}
          />
          <LlmResponse ref={responseRef} response={log.response} />
        </>
      )}
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
  request: ChatType;
  finished: boolean;
}) {
  return (
    <div className={finished ? "" : "bg-blue-950"}>
      {request.messages.map((message, index) => (
        <LlmRequestItem
          key={index}
          role={message.role}
          content={message.content}
        />
      ))}
    </div>
  );
}

function LlmRequestItem({ role, content }: { role: string; content: string }) {
  return (
    <pre className="whitespace-pre-wrap -indent-2 pl-2 mb-2">
      <strong className="text-cyan-300">{role}:</strong> {content}
    </pre>
  );
}

const LlmResponse = forwardRef<HTMLPreElement, { response?: string }>(
  ({ response }, ref) => {
    if (!response) {
      return null;
    }
    return (
      <pre
        ref={ref}
        className="whitespace-pre-wrap text-white bg-green-900 -indent-2 pl-2"
      >
        <strong>model:</strong> {response}
      </pre>
    );
  }
);

LlmResponse.displayName = "LlmResponse";

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

export function clearLogs() {
  console.log("clear");
  logSignal.value = logSignal.value.filter(
    (log) => log.end === undefined && !log.errorMessage
  );
  console.log("done", logSignal.value);
}
