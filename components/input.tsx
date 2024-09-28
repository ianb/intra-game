import { useSignal } from "@preact/signals-react";
import React from "react";
import { twMerge } from "tailwind-merge";

export function Button({
  className,
  children,
  onClick,
  ...props
}: {
  onClick: () => void | Promise<void>;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = twMerge("bg-green-600 text-white p-2", className);
  const error = useSignal<Error | null>(null);
  const running = useSignal(false);
  function handleClick() {
    let resp: any;
    try {
      resp = onClick();
      error.value = null;
    } catch (e) {
      error.value = e as Error;
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
