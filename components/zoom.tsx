import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import React, { useEffect } from "react";
import { twMerge } from "tailwind-merge";

export function ZoomOverlay({
  onDone,
  className,
  children,
}: {
  onDone: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  useSignals();
  const handleBackgroundClick = () => {
    onDone();
  };
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Prevent the background click event
    if ((e.target as HTMLDivElement).className.includes("done")) {
      onDone();
    }
  };
  useEffect(() => {
    // Escape will close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDone();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDone]);
  return (
    <div
      onClick={handleBackgroundClick}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50"
    >
      <div
        onClick={handleContentClick}
        className={twMerge("relative", className)}
      >
        {children}
      </div>
      <button
        onClick={onDone}
        className="absolute top-4 right-4 text-white text-2xl focus:outline-none"
      >
        &times;
      </button>
    </div>
  );
}

export function ZoomControl({ children }: { children: React.ReactNode }) {
  useSignals();
  const opened = useSignal(false);
  return (
    <span>
      {opened.value && children}
      <button
        onClick={() => (opened.value = !opened.value)}
        className="opacity-75 hover:opacity-100 text-2xl focus:outline-none"
      >
        {opened.value ? "🔍➖" : "🔍➕"}
      </button>
    </span>
  );
}
