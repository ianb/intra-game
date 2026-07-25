// The engine feature-detects browser globals so the same code runs in a browser
// and in a Worker (`typeof window !== "undefined"`). Declared here so the
// Worker-typed build can see those guarded references without pulling in the
// whole DOM lib, which would wrongly suggest DOM APIs are available here.
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
declare const window:
  { localStorage: StorageLike; sessionStorage: StorageLike } | undefined;
declare const location: { origin: string } | undefined;
