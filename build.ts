import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context, type BuildOptions } from "esbuild";
import { parse } from "yaml";

// Builds the static site into dist/, which is what Cloudflare serves alongside
// the Worker in worker/.
//
// esbuild bundles the app, the Tailwind CLI builds the stylesheet, and the HTML
// shell, static assets and the generated eval page are copied across.
//
//   pnpm build          one-shot production build
//   pnpm dev            the whole rig: this in watch mode, plus the Worker
//   pnpm dev:client     this alone, serving dist/ — a view with no engine

const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, "dist");
const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");
const dev = watch || serve;

/**
 * What is in this build, so a deployment can be identified from outside.
 *
 * "Wait a couple of minutes and see if it looks different" is not a way to
 * know whether a deploy landed, and it is wrong twice over: the build may not
 * be finished, and the browser may be holding a cached bundle. Both are
 * answerable if the build says which commit it is.
 *
 * Cloudflare's builder sets WORKERS_CI_COMMIT_SHA. Locally there is git. In
 * neither case is a failure worth stopping a build over.
 */
function buildVersion(): { sha: string; built: string } {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA;
  if (fromCi) {
    return { sha: fromCi.slice(0, 7), built: new Date().toISOString() };
  }
  const git = spawnSync("git", ["rev-parse", "--short=7", "HEAD"], {
    encoding: "utf8",
  });
  return {
    sha: git.status === 0 ? git.stdout.trim() : "unknown",
    built: new Date().toISOString(),
  };
}

const version = buildVersion();

const buildOptions: BuildOptions = {
  entryPoints: [resolve(root, "app/main.tsx")],
  outfile: resolve(outdir, "main.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  sourcemap: true,
  minify: !dev,
  define: {
    "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
    // So the running page can say which build it is, without a fetch.
    __BUILD_SHA__: JSON.stringify(version.sha),
  },
  // The `@/...` alias used throughout the app, matching tsconfig paths.
  alias: { "@": root },
  loader: { ".svg": "file", ".ico": "file" },
  logLevel: "info",
};

function buildCss() {
  const result = spawnSync(
    "tailwindcss",
    [
      "-i",
      resolve(root, "app/globals.css"),
      "-o",
      resolve(outdir, "styles.css"),
      ...(dev ? [] : ["--minify"]),
    ],
    { stdio: "inherit", shell: true },
  );
  if (result.status !== 0) {
    throw new Error(`tailwindcss exited with ${result.status}`);
  }
}

function copyStatic() {
  // Served at /version.json, and deployed in the same `wrangler deploy` as the
  // Worker — so if this is current, the Worker is too.
  writeFileSync(
    resolve(outdir, "version.json"),
    JSON.stringify(version, null, 2),
  );
  cpSync(resolve(root, "app/index.html"), resolve(outdir, "index.html"));
  cpSync(resolve(root, "app/favicon.ico"), resolve(outdir, "favicon.ico"));
  cpSync(resolve(root, "app/assets"), resolve(outdir, "assets"), {
    recursive: true,
  });
  // The eval results, served at /evals/. It is generated and committed by
  // `pnpm evals`, so this is a copy rather than a build step — the deploy
  // doesn't need a model, a key, or anything the CF builder doesn't have.
  mkdirSync(resolve(outdir, "evals"), { recursive: true });
  cpSync(
    resolve(root, "evals/index.html"),
    resolve(outdir, "evals/index.html"),
  );
  // The rendered quest playthroughs, served at /playthroughs/. Generated and
  // committed by `pnpm playthroughs`, same contract as the eval page.
  cpSync(
    resolve(root, "evals/playthroughs"),
    resolve(outdir, "playthroughs"),
    { recursive: true },
  );
  // The talk about how this was built, served at /slides/. Generated and
  // committed by `pnpm slides`, same contract again. Nothing links to it from
  // the game or the README: it gives away every mystery, so it is for someone
  // handed the URL rather than for someone browsing.
  mkdirSync(resolve(outdir, "slides"), { recursive: true });
  cpSync(
    resolve(root, "slides/index.html"),
    resolve(outdir, "slides/index.html"),
  );
  copyCheckpoints();
}

/**
 * Ship the recorded checkpoints so the running game can start from one.
 *
 * YAML on disk because they are read in diffs; JSON in dist because the browser
 * would otherwise need a parser for a file it reads once. Converted here rather
 * than committed twice — one 44K checkpoint duplicated in git per format is a
 * bad trade for a build step that takes milliseconds.
 *
 * (`yaml` is a runtime dependency for exactly this reason: the Cloudflare
 * builder installs with --prod, so a devDependency here would break the deploy
 * and nowhere else.)
 */
function copyCheckpoints() {
  const from = resolve(root, "playtest/checkpoints");
  const to = resolve(outdir, "checkpoints");
  mkdirSync(to, { recursive: true });
  const index = readdirSync(from)
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => {
      const checkpoint = parse(readFileSync(resolve(from, file), "utf8"));
      writeFileSync(
        resolve(to, file.replace(/\.yaml$/, ".json")),
        JSON.stringify(checkpoint),
      );
      return {
        name: checkpoint.name,
        describe: checkpoint.describe,
        recorded: checkpoint.recorded,
        model: checkpoint.model,
        events: checkpoint.events.length,
      };
    });
  writeFileSync(resolve(to, "index.json"), JSON.stringify(index));
}

async function main() {
  // Emptying dist/ is right for a production build and wrong in watch mode,
  // where this process starts *beside* a wrangler that serves the directory —
  // `pnpm dev` builds once, then spawns the watcher and the Worker together,
  // so wiping here deletes the site out from under the server while it is
  // scanning for assets. Whatever has not been rewritten yet is missing from
  // that scan, and the copy order decides what: the shell is written first and
  // survives, so the game comes up fine and one late page 404s, differently on
  // each run. Watch mode overwrites in place instead; dev.ts's first build
  // already produced a clean directory.
  if (!dev) {
    rmSync(outdir, { recursive: true, force: true });
  }
  mkdirSync(outdir, { recursive: true });
  buildCss();
  copyStatic();

  if (!dev) {
    await build(buildOptions);
    console.log(`Built to ${outdir}`);
    return;
  }

  const ctx = await context(buildOptions);
  await ctx.watch();
  if (serve) {
    const { host, port } = await ctx.serve({ servedir: outdir, port: 3000 });
    console.log(
      `Serving http://${host === "0.0.0.0" ? "localhost" : host}:${port}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
