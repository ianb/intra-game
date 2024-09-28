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

export class SignalView<T> implements SignalType<T> {
  constructor(
    public signal: SignalType<any>,
    public attr: string,
    public defaultValue: T
  ) {
    this.signal = signal;
    this.attr = attr;
    this.defaultValue = defaultValue;
  }

  get value() {
    const obj = this.signal.value;
    if (!obj || typeof obj !== "object") {
      return this.defaultValue;
    }
    const v = obj[this.attr];
    if (v === undefined) {
      return this.defaultValue;
    }
    return v;
  }

  set value(v: T) {
    const obj = this.signal.value;
    if (!obj || typeof obj !== "object") {
      throw new Error(`Cannot set .${this.attr} on ${obj}`);
    }
    const newObj = { ...obj };
    newObj[this.attr] = v;
    this.signal.value = newObj;
  }

  peek() {
    const obj = this.signal.peek();
    if (!obj || typeof obj !== "object") {
      return this.defaultValue;
    }
    const v = obj[this.attr];
    if (v === undefined) {
      return this.defaultValue;
    }
    return v;
  }
}
