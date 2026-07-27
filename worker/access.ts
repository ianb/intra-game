/**
 * Cloudflare Access assertion verification.
 *
 * Access terminates the identity flow and forwards a signed JWT to the Worker.
 * This module does the one cryptographic thing the server owns: verify that
 * assertion against Cloudflare's published Access JWKS and extract the verified
 * email. It is not an OAuth flow — no IdP round-trip, no session cookie we set.
 *
 * Fail-closed throughout: a missing header, malformed token, bad signature,
 * wrong `aud`/`iss`, expiry, or an unreachable JWKS all produce a typed negative
 * result. Nothing throws out to become a 500, and nothing is admitted on doubt.
 *
 * Ported from callback-box's pub-worker (src/access.ts), with the schema
 * validation written out by hand rather than pulling in a validation library.
 *
 * The RS256 and JWKS machinery lives in ./jwt.ts, shared with the Google ID
 * token verification that does the same job for the public sign-in.
 */

import {
  isRecord,
  jwksFetcher,
  readCookie,
  verifyRs256,
  type GetJwks,
} from "./jwt";
import {
  googleConfig,
  verifyGoogleSession,
  type GoogleConfig,
} from "./googleauth";

export interface AccessConfig {
  /** Full origin, e.g. `https://myteam.cloudflareaccess.com` — also the `iss`. */
  teamDomain: string;
  /** The Access application `aud` tag the token must be scoped to. */
  aud: string;
}

export type AccessResult =
  | { ok: true; email: string }
  | { ok: false; reason: "no-assertion" | "invalid" | "jwks-unavailable" };

/** Access tokens are edge-minted, so allow a little clock skew. */
const CLOCK_SKEW_MS = 60_000;

export const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";

interface JwtPayload {
  aud: string | string[];
  iss: string;
  exp: number;
  email: string;
  nbf?: number;
  iat?: number;
}

/** Access config, or null when this deployment hasn't been set up for it. */
export function accessConfig(env: {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}): AccessConfig | null {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.ACCESS_AUD?.trim();
  if (!teamDomain || !aud) {
    return null;
  }
  return { teamDomain, aud };
}

export async function verifyAccessAssertion({
  request,
  config,
  getJwks,
  now,
}: {
  request: Request;
  config: AccessConfig;
  getJwks: GetJwks;
  now?: () => number;
}): Promise<AccessResult> {
  const nowMs = now === undefined ? Date.now() : now();

  const token = extractToken(request);
  // A null check on the extracted token, not a comparison against a secret.
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (token === null) {
    return { ok: false, reason: "no-assertion" };
  }

  const verified = await verifyRs256(token, getJwks);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason };
  }
  const payload = asJwtPayload(verified.payload);
  if (payload === null) {
    return { ok: false, reason: "invalid" };
  }
  if (!claimsValid({ payload, config, nowMs })) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, email: payload.email };
}

/** Read the assertion from the header, falling back to the Access cookie. */
function extractToken(request: Request): string | null {
  const header = request.headers.get(ACCESS_HEADER);
  if (header !== null && header.length > 0) {
    return header;
  }
  return readCookie(request.headers.get("Cookie"), "CF_Authorization");
}

function claimsValid({
  payload,
  config,
  nowMs,
}: {
  payload: JwtPayload;
  config: AccessConfig;
  nowMs: number;
}): boolean {
  const audOk = Array.isArray(payload.aud)
    ? payload.aud.includes(config.aud)
    : payload.aud === config.aud;
  if (!audOk) {
    return false;
  }
  if (payload.iss !== config.teamDomain) {
    return false;
  }
  if (nowMs >= payload.exp * 1000 + CLOCK_SKEW_MS) {
    return false;
  }
  if (payload.nbf !== undefined && nowMs < payload.nbf * 1000 - CLOCK_SKEW_MS) {
    return false;
  }
  if (payload.iat !== undefined && payload.iat * 1000 > nowMs + CLOCK_SKEW_MS) {
    return false;
  }
  return true;
}

// --- Hand-written validation (Access-specific claims) -------------------------

function asJwtPayload(raw: unknown): JwtPayload | null {
  if (!isRecord(raw)) return null;
  const { aud, iss, exp, email, nbf, iat } = raw;
  const audOk =
    typeof aud === "string" ||
    (Array.isArray(aud) && aud.every((a) => typeof a === "string"));
  if (!audOk) return null;
  if (typeof iss !== "string") return null;
  if (typeof exp !== "number") return null;
  if (typeof email !== "string" || !email) return null;
  if (nbf !== undefined && typeof nbf !== "number") return null;
  if (iat !== undefined && typeof iat !== "number") return null;
  return { aud: aud as string | string[], iss, exp, email, nbf, iat };
}

/** Cloudflare's Access JWKS for a team domain. */
export function jwksFetcherFor(teamDomain: string): GetJwks {
  return jwksFetcher(`${teamDomain}/cdn-cgi/access/certs`);
}

// --- Worker-facing gate -------------------------------------------------------

export type AuthResult =
  { ok: true; email: string } | { ok: false; response: Response };

/** Which identity source this deployment uses, if any. */
export type AuthMode = "access" | "google" | "dev" | "none";

/**
 * How this deployment decides who someone is.
 *
 * Access and Google answer the same question and are not meant to be combined:
 * Access is a private allowlist, Google is a public sign-in, and a deployment
 * wanting both is a deployment that hasn't decided. Access wins where both are
 * set, because it is the more restrictive of the two and silently loosening a
 * gate is the wrong way to resolve a misconfiguration.
 */
export function authMode(env: {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  DEV_IDENTITY?: string;
}): AuthMode {
  if (accessConfig(env)) {
    return "access";
  }
  if (googleConfig(env)) {
    return "google";
  }
  return env.DEV_IDENTITY ? "dev" : "none";
}

export interface AuthEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  DEV_IDENTITY?: string;
}

/**
 * Authenticate a request, with the fail-closed policy:
 *  - no identity source configured → 404 (the gated surface isn't set up here,
 *    so treat it as missing rather than advertising it with a 401)
 *  - anything else wrong → 401
 *
 * The DEV_IDENTITY bypass is reachable only in the "dev" mode, which by
 * construction means neither real source is configured. That is the property
 * worth keeping: a DEV_IDENTITY left in production variables cannot open a hole
 * next to a configured gate, whichever gate it is.
 */
export async function authenticate(
  request: Request,
  env: AuthEnv,
): Promise<AuthResult> {
  const unauthorized = (): AuthResult => ({
    ok: false,
    response: new Response("Unauthorized", { status: 401 }),
  });
  switch (authMode(env)) {
    case "access": {
      const config = accessConfig(env)!;
      const result = await verifyAccessAssertion({
        request,
        config,
        getJwks: jwksFetcherFor(config.teamDomain),
      });
      return result.ok ? { ok: true, email: result.email } : unauthorized();
    }
    case "google": {
      const config: GoogleConfig = googleConfig(env)!;
      const email = await verifyGoogleSession(request, config);
      return email ? { ok: true, email } : unauthorized();
    }
    case "dev":
      return { ok: true, email: env.DEV_IDENTITY! };
    default:
      return {
        ok: false,
        response: new Response("Not found", { status: 404 }),
      };
  }
}
