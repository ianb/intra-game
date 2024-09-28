import { signal, effect } from "@preact/signals-react";

export interface SignalType<T> {
  value: T;
  peek: () => T;
}

export function persistentSignal<T>(
  name: string,
  defaultValue: T,
  options?: {
    sessionStorage?: boolean;
  }
): SignalType<T> {
  if (typeof window === "undefined") {
    // On the server
    return signal(defaultValue);
  }
  const storage =
    options && options.sessionStorage
      ? window.sessionStorage
      : window.localStorage;
  if (!name || typeof name !== "string") {
    throw new Error("name must be a string");
  }
  const rawValue = storage.getItem(`signal.${name}`);
  let value: T;
  if (rawValue) {
    value = JSON.parse(rawValue);
    // value = deserialize(value);
  } else {
    value = defaultValue;
  }
  const s = signal(value);
  effect(() => {
    try {
      storage.setItem(`signal.${name}`, JSON.stringify(s.value));
    } catch (e) {
      console.error("Error saving signal", name, s.value, e);
      throw e;
    }
  });
  return s;
}
