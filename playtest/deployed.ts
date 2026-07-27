import { spawnSync } from "node:child_process";

/**
 * Is what's deployed the code I have?
 *
 *     pnpm deployed                     # checks playintra.win
 *     pnpm deployed https://other.url
 *
 * Every build writes dist/version.json with the commit it was built from, and
 * it ships in the same `wrangler deploy` as the Worker — so if that file is
 * current, the Worker is current too.
 *
 * This exists because the alternative is reloading and squinting, which is
 * wrong in two different ways at once: the build may still be running, and the
 * browser may be showing a cached bundle. Neither is visible by looking at the
 * page, and they need opposite responses.
 */

const DEFAULT_URL = "https://playintra.win";

interface Version {
  sha: string;
  built: string;
}

function git(...args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

async function fetchVersion(base: string): Promise<Version | null> {
  try {
    // Cache-busted: the whole point is to see what the origin has, and a CDN
    // hit would answer with what it was serving before the deploy.
    const response = await fetch(`${base}/version.json?t=${Date.now()}`, {
      headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Version;
  } catch {
    return null;
  }
}

async function main() {
  const base = (process.argv[2] ?? DEFAULT_URL).replace(/\/$/, "");
  const local = git("rev-parse", "--short=7", "HEAD");
  const deployed = await fetchVersion(base);

  if (!deployed) {
    console.log(`${base} has no version.json.`);
    console.log(
      "  Either the deploy predates build stamping, or the site is down.",
    );
    process.exit(1);
  }

  const age = Math.round((Date.now() - Date.parse(deployed.built)) / 60_000);
  console.log(`${base}`);
  console.log(`  deployed ${deployed.sha}, built ${age} minute(s) ago`);
  console.log(`  local    ${local}`);

  if (deployed.sha === local) {
    console.log("\nUp to date.");
    return;
  }

  // Which way round matters. Behind means wait; ahead means the deploy failed
  // or was never triggered, and waiting will not fix it.
  const behind = git("rev-list", "--count", `${deployed.sha}..HEAD`);
  const ahead = git("rev-list", "--count", `HEAD..${deployed.sha}`);
  if (behind && Number(behind) > 0) {
    console.log(`\nDeployed build is ${behind} commit(s) behind local.`);
    console.log("  If you just pushed, the build is probably still running.");
    console.log(git("log", "--oneline", `${deployed.sha}..HEAD`));
    process.exit(1);
  }
  if (ahead && Number(ahead) > 0) {
    console.log(`\nDeployed build is ${ahead} commit(s) ahead of local.`);
    console.log("  Someone else pushed, or this checkout is stale.");
    process.exit(1);
  }
  console.log("\nDeployed build is on a different branch to this checkout.");
  process.exit(1);
}

void main();
