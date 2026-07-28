import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The development rig: one command, both halves.
 *
 *     pnpm dev
 *
 * The client used to be the whole of `pnpm dev` — esbuild watching and serving
 * dist/ on :3000 — because the browser ran the engine and there was nothing else
 * to run. The engine is on the server now, so a static file server serves a view
 * of nothing: it loads, asks /api/auth, gets nothing back from a server that
 * isn't there, and sits looking broken.
 *
 * So this runs esbuild in watch mode *and* the Worker, on one port, and holds
 * them together: either dying takes the other with it, and Ctrl-C stops both. A
 * rig that leaves half of itself running is worse than no rig, because the half
 * still up holds the port and answers requests.
 */

const root = dirname(fileURLToPath(import.meta.url));
const PORT = 8787;

/** A local binary, run directly rather than through npx.
 *
 * `npx x` is `npm exec` is `sh -c x` is x — three processes between this one
 * and the thing holding the port, and signalling the top of that stack left the
 * bottom of it running. Fewer layers is the fix, and npx was doing nothing here
 * that a path doesn't.
 */
function bin(name: string): string {
  return resolve(root, "node_modules/.bin", name);
}

function checkDevVars(): void {
  if (existsSync(resolve(root, ".dev.vars"))) {
    return;
  }
  // Not fatal — wrangler starts without it — but every path through the server
  // needs an identity and a model, and both come from that file, so the first
  // turn fails in a way that looks like a bug in the game.
  console.log(
    "\nNo .dev.vars — copy .dev.vars.example to .dev.vars first.\n" +
      "Without it there is no identity and no model, and the first turn fails.\n",
  );
}

function run(label: string, command: string, args: string[]): ChildProcess {
  const child = spawn(command, args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    // Its own process group, so stopping it stops whatever it started.
    detached: process.platform !== "win32",
  });
  const prefix = (stream: NodeJS.ReadableStream, to: NodeJS.WriteStream) => {
    let buffer = "";
    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        // Both talk at once, so say which is talking.
        to.write(`[${label}] ${line}\n`);
      }
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  return child;
}

function signal(child: ChildProcess, sig: NodeJS.Signals): void {
  if (child.pid === undefined) {
    return;
  }
  try {
    // Negative pid: the group, not just its leader.
    process.kill(process.platform === "win32" ? child.pid : -child.pid, sig);
  } catch {
    // Already gone, which is the outcome being asked for.
  }
}

function main(): void {
  checkDevVars();

  // Built once, synchronously, before the Worker starts: wrangler reads ./dist
  // at startup, and a missing directory is a hard error rather than an empty
  // site.
  console.log("[build] first build...");
  const first = spawnSync(bin("tsx"), ["build.ts"], {
    cwd: root,
    stdio: "inherit",
  });
  if (first.status !== 0) {
    process.exit(first.status ?? 1);
  }

  const children: ChildProcess[] = [
    run("build", bin("tsx"), ["build.ts", "--watch"]),
    run("worker", bin("wrangler"), ["dev", "--port", String(PORT)]),
  ];

  let stopping = false;
  const stopAll = (code: number) => {
    if (stopping) {
      return;
    }
    stopping = true;
    for (const child of children) {
      signal(child, "SIGTERM");
    }
    // Ask, then insist. workerd does not always go on the first request, and a
    // rig that half-stops holds the port against the next `pnpm dev`.
    setTimeout(() => {
      for (const child of children) {
        signal(child, "SIGKILL");
      }
      process.exit(code);
    }, 500);
  };

  for (const child of children) {
    child.on("exit", (code) => stopAll(code ?? 0));
    child.on("error", (e) => {
      console.error(String(e));
      stopAll(1);
    });
  }
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => stopAll(0));
  }

  console.log(`\n  Intra: http://localhost:${PORT}\n`);
}

main();
