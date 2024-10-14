import { useSignal } from "@preact/signals-react";
import React, { useEffect } from "react";

export function ZoomOverlay({
  onDone,
  children,
}: {
  onDone: () => void;
  children: React.ReactNode;
}) {
  const handleBackgroundClick = () => {
    onDone();
  };
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Prevent the background click event
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
      <div onClick={handleContentClick} className="relative">
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
