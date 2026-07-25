import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context, type BuildOptions } from "esbuild";

// Builds the static site into dist/, which is what Cloudflare serves.
//
// The game is entirely client-side (state lives in browser storage, the LLM is
// called from the browser), so there is no server build: esbuild bundles the
// app, the Tailwind CLI builds the stylesheet, and the HTML shell and static
// assets are copied across.
//
//   pnpm build          one-shot production build
//   pnpm dev            rebuild on change and serve locally

const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, "dist");
const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");
const dev = watch || serve;

const buildOptions: BuildOptions = {
  entryPoints: [resolve(root, "app/main.tsx")],
  outfile: resolve(outdir, "main.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  sourcemap: true,
  minify: !dev,
  define: { "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production") },
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
    { stdio: "inherit", shell: true }
  );
  if (result.status !== 0) {
    throw new Error(`tailwindcss exited with ${result.status}`);
  }
}

function copyStatic() {
  cpSync(resolve(root, "app/index.html"), resolve(outdir, "index.html"));
  cpSync(resolve(root, "app/favicon.ico"), resolve(outdir, "favicon.ico"));
  cpSync(resolve(root, "app/assets"), resolve(outdir, "assets"), {
    recursive: true,
  });
}

async function main() {
  rmSync(outdir, { recursive: true, force: true });
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
    console.log(`Serving http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
