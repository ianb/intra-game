import { signal } from "@preact/signals-react";
import { SignalType } from "./persistentsignal";

type FuncType<T> = () => Promise<T>;
type QueuedType<T> = {
  func: FuncType<T>;
  resolve: (v: any) => void;
  reject: (error: Error) => void;
  number: number;
};

export class TrackSettled {
  queue: QueuedType<unknown>[];
  running: number[] = [];
  runningSignal: SignalType<boolean>;
  number = 0;

  constructor() {
    this.queue = [];
    this.runningSignal = signal(false);
  }

  async run<T>(func: FuncType<T>): Promise<T> {
    const number = this.number++;
    this.runningSignal.value = true;
    this.running.push(number);
    const forcePromiseFunc = Promise.resolve().then(() => func());
    try {
      return await forcePromiseFunc;
    } finally {
      if (!this.running.includes(number)) {
        console.error(
          "PromiseQueue: promise queue missing expected item",
          number
        );
      }
      this.running = this.running.filter((n) => n !== number);
      if (!this.running.length) {
        this.runningSignal.value = false;
      }
    }
  }
}
