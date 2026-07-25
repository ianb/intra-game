import { signal, effect } from "@preact/signals-core";
import { read, stamp } from "./storage";

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
    /**
     * Stamp the stored value with the storage version; see lib/storage.ts.
     *
     * Worth it for anything that would hurt to lose or to misread — the game
     * log — and not for view state like which tab is open, where the recovery
     * from an unreadable value is to pick a tab again.
     */
    versioned?: boolean;
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
  const key = `signal.${name}`;
  const versioned = !!options?.versioned;

  function load(): T {
    const rawValue = storage.getItem(key);
    if (!rawValue || rawValue === "undefined") {
      return defaultValue;
    }
    const parsed = JSON.parse(rawValue);
    if (!versioned) {
      return parsed as T;
    }
    const result = read<T>(parsed);
    if (result.ok) {
      return result.value;
    }
    // Written by a newer build — an old tab reopened after a deploy, most
    // likely. It gets moved aside rather than overwritten: the effect below
    // writes on the very next change, and silently flattening someone's game
    // because their tab was stale is not a recovery.
    console.error(
      `Cannot read ${key}: ${result.reason}. Kept at ${key}.unreadable`,
    );
    storage.setItem(`${key}.unreadable`, rawValue);
    return defaultValue;
  }

  const s: SignalType<T> = signal(load());
  s.refresh = () => {
    s.value = load();
  };
  effect(() => {
    try {
      storage.setItem(
        key,
        JSON.stringify(versioned ? stamp(s.value) : s.value),
      );
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
