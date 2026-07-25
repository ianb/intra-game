import { signal, effect } from "@preact/signals-core";

export interface SignalType<T> {
  value: T;
  peek: () => T;
  /**
   * Re-read the backing store. Only persistent signals in the browser have
   * one — the server stand-in and plain views don't, hence the `?`.
   */
  refresh?: () => void;
}

export function persistentSignal<T>(
  name: string,
  defaultValue: T,
  options?: {
    sessionStorage?: boolean;
  },
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
  if (rawValue && rawValue !== "undefined") {
    value = JSON.parse(rawValue);
    // value = deserialize(value);
  } else {
    value = defaultValue;
  }
  const s: SignalType<T> = signal(value);
  s.refresh = () => {
    const rawValue = storage.getItem(`signal.${name}`);
    let value: T;
    if (rawValue) {
      value = JSON.parse(rawValue);
      // value = deserialize(value);
    } else {
      value = defaultValue;
    }
    s.value = value;
  };
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

/**
 * One attribute of an object-valued signal, as a signal of its own.
 *
 * The backing signal is a plain record, so nothing checks that its `attr` field
 * really holds a T — the two reads below assert it. That is the contract of a
 * view: whoever constructs it declares the type, and `defaultValue` covers the
 * case where the attribute is missing.
 */
export class SignalView<T> implements SignalType<T> {
  constructor(
    public signal: SignalType<Record<string, unknown>>,
    public attr: string,
    public defaultValue: T,
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
    return v as T;
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
    return v as T;
  }
}
