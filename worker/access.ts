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
 */

export interface AccessConfig {
  /** Full origin, e.g. `https://myteam.cloudflareaccess.com` — also the `iss`. */
  teamDomain: string;
  /** The Access application `aud` tag the token must be scoped to. */
  aud: string;
}

export type AccessResult =
  | { ok: true; email: string }
  | { ok: false; reason: "no-assertion" | "invalid" | "jwks-unavailable" };

export interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

/** Supplies the current JWKS; null means unavailable, which fails closed. */
export type GetJwks = () => Promise<readonly Jwk[] | null>;

/** Access tokens are edge-minted, so allow a little clock skew. */
const CLOCK_SKEW_MS = 60_000;
/** Access certs rotate slowly; trust a fetched key set this long. */
const JWKS_TTL_MS = 10 * 60_000;

export const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";

interface JwtHeader {
  alg: string;
  kid: string;
}
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

  const parts = token.split(".");
  const [headerB64, payloadB64, signatureB64] = parts;
  if (
    parts.length !== 3 ||
    headerB64 === undefined ||
    payloadB64 === undefined ||
    signatureB64 === undefined
  ) {
    return { ok: false, reason: "invalid" };
  }

  const header = decodeJson(headerB64, asJwtHeader);
  // Cloudflare Access uses RS256; pin it rather than trusting the token's own
  // `alg`, which is how `alg: "none"` downgrade attacks work.
  if (header === null || header.alg !== "RS256") {
    return { ok: false, reason: "invalid" };
  }

  const payload = decodeJson(payloadB64, asJwtPayload);
  if (payload === null) {
    return { ok: false, reason: "invalid" };
  }

  const jwks = await getJwks();
  if (jwks === null) {
    return { ok: false, reason: "jwks-unavailable" };
  }

  const signature = base64UrlToBytes(signatureB64);
  if (signature === null) {
    return { ok: false, reason: "invalid" };
  }

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await verifySignature({
    jwks,
    kid: header.kid,
    signature,
    data: signingInput,
  });
  if (!valid) {
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
  const cookie = request.headers.get("Cookie");
  if (cookie === null) {
    return null;
  }
  return readCookie(cookie, "CF_Authorization");
}

function readCookie(cookieHeader: string, name: string): string | null {
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) {
      continue;
    }
    if (pair.slice(0, eq).trim() === name) {
      const value = pair.slice(eq + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

async function verifySignature({
  jwks,
  kid,
  signature,
  data,
}: {
  jwks: readonly Jwk[];
  kid: string;
  signature: Uint8Array;
  data: Uint8Array;
}): Promise<boolean> {
  const jwk = jwks.find((k) => k.kid === kid);
  if (jwk === undefined) {
    return false;
  }
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      signature,
      data
    );
  } catch {
    // A malformed key or signature is a verification failure, not a 500.
    return false;
  }
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

// --- Hand-written validation (no schema library here) -------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asJwtHeader(raw: unknown): JwtHeader | null {
  if (!isRecord(raw)) return null;
  const { alg, kid } = raw;
  if (typeof alg !== "string" || typeof kid !== "string" || !kid) return null;
  return { alg, kid };
}

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

function asJwks(raw: unknown): readonly Jwk[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.keys)) return null;
  const keys: Jwk[] = [];
  for (const k of raw.keys) {
    if (!isRecord(k)) return null;
    const { kid, kty, n, e } = k;
    if (kty !== "RSA") continue;
    if (typeof kid !== "string" || !kid) return null;
    if (typeof n !== "string" || !n) return null;
    if (typeof e !== "string" || !e) return null;
    keys.push({ kid, kty, n, e });
  }
  return keys;
}

function decodeJson<T>(
  segment: string,
  validate: (raw: unknown) => T | null
): T | null {
  const text = base64UrlToString(segment);
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  return validate(raw);
}

function base64UrlToBytes(input: string): Uint8Array | null {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  // atob yields a latin1 string: each char is exactly one 0-255 byte.
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToString(input: string): string | null {
  const bytes = base64UrlToBytes(input);
  if (bytes === null) return null;
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

// --- Production JWKS fetcher (module-cached per team domain) -------------------

const fetchers = new Map<string, GetJwks>();

/**
 * The production JWKS supplier for a team domain, cached at module scope so the
 * key set survives across requests in a warm Worker. Returns null on any
 * fetch/parse failure with no valid cache, which the caller turns into a 401.
 */
export function jwksFetcherFor(teamDomain: string): GetJwks {
  const existing = fetchers.get(teamDomain);
  if (existing !== undefined) {
    return existing;
  }
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  let cache: { keys: readonly Jwk[]; expiresAt: number } | null = null;
  const fetcher: GetJwks = async () => {
    if (cache !== null && Date.now() < cache.expiresAt) {
      return cache.keys;
    }
    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        console.warn(`Access JWKS for ${teamDomain} returned ${response.status}`);
        return null;
      }
      const keys = asJwks(await response.json());
      if (keys === null) {
        console.warn(`Access JWKS for ${teamDomain} failed validation`);
        return null;
      }
      cache = { keys, expiresAt: Date.now() + JWKS_TTL_MS };
      return keys;
    } catch (e) {
      console.warn(`Access JWKS fetch failed for ${teamDomain}: ${String(e)}`);
      return null;
    }
  };
  fetchers.set(teamDomain, fetcher);
  return fetcher;
}

// --- Worker-facing gate -------------------------------------------------------

export type AuthResult =
  | { ok: true; email: string }
  | { ok: false; response: Response };

/**
 * Authenticate a request, with the fail-closed policy:
 *  - Access not configured → 404 (the gated surface isn't set up here, so treat
 *    it as missing rather than advertising it with a 401)
 *  - anything else wrong → 401
 */
export async function authenticate(
  request: Request,
  env: {
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    DEV_IDENTITY?: string;
  }
): Promise<AuthResult> {
  const config = accessConfig(env);
  if (!config) {
    // No Access configured. For local development an explicit DEV_IDENTITY
    // stands in for a verified user, so the server can be exercised offline
    // with no Cloudflare account.
    //
    // This is safe by construction rather than by discipline: the branch is only
    // reachable when Access is UNCONFIGURED. Any deployment that sets a team
    // domain and aud takes the path below and verifies for real, so DEV_IDENTITY
    // leaking into production vars cannot open a bypass.
    if (env.DEV_IDENTITY) {
      return { ok: true, email: env.DEV_IDENTITY };
    }
    return { ok: false, response: new Response("Not found", { status: 404 }) };
  }
  const result = await verifyAccessAssertion({
    request,
    config,
    getJwks: jwksFetcherFor(config.teamDomain),
  });
  if (!result.ok) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  }
  return { ok: true, email: result.email };
}
