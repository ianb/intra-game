/**
 * Hang a value off `window` so it can be poked at from the browser console.
 *
 * Every one of these used to be its own `(window as any).x = y`. They are all
 * debug affordances rather than API, so they get one typed door instead: the
 * cast lives here, callers pass `unknown`, and a no-op off the browser means
 * engine code carrying one of these still runs in a Worker.
 */
export function exposeGlobal(name: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  (window as unknown as Record<string, unknown>)[name] = value;
}
