import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import React from "react";
import { twMerge } from "tailwind-merge";
import { SignalType } from "@/lib/persistentsignal";

export function Button({
  className,
  children,
  onClick,
  ...props
}: {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  useSignals();
  const cls = twMerge("bg-green-600 text-white p-2", className);
  const error = useSignal<Error | null>(null);
  const running = useSignal(false);
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    let resp: any;
    try {
      resp = onClick(event);
      error.value = null;
    } catch (e) {
      error.value = e as Error;
      console.error("Error in handler:", e);
    }
    if (resp && resp.then) {
      running.value = true;
      resp
        .catch((e: Error) => {
          error.value = e;
        })
        .finally(() => {
          running.value = false;
        });
    }
  }
  return (
    <button onClick={handleClick} className={cls} {...props}>
      {children}
      {running.value && <span className="ml-2">...</span>}
      {error.value && (
        <div className="text-red-600 text-xs">{error.value.message}</div>
      )}
    </button>
  );
}

export function CheckButton({
  className,
  signal,
  on,
  off,
  onClass,
  offClass,
}: {
  className?: string;
  signal: SignalType<boolean>;
  on: React.ReactNode;
  off: React.ReactNode;
  onClass?: string;
  offClass?: string;
}) {
  useSignals();
  onClass = onClass || "bg-green-600 border border-green-700 p-1";
  offClass = offClass || "bg-green-950 border border-green-700 p-1";
  const cls = twMerge(className, signal.value ? onClass : offClass);
  return (
    <Button
      className={cls}
      onClick={() => {
        signal.value = !signal.value;
      }}
    >
      {signal.value ? on : off}
    </Button>
  );
}

export function WithBlinkingCursor({
  children,
}: {
  children: React.ReactNode;
}) {
  useSignals();
  return (
    <span>
      &nbsp;{children}
      <span className="blinking-cursor">█</span>
    </span>
  );
}

export function A({
  blank,
  className,
  ...props
}: { blank?: boolean } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  useSignals();
  const p = { ...props };
  if (blank) {
    p.target = "_blank";
  }
  return (
    <a className={twMerge("text-cyan-300 hover:underline", className)} {...p} />
  );
}
