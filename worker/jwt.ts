/**
 * RS256 verification and JWKS fetching, shared by the two things that verify a
 * signed token: Cloudflare Access assertions and Google ID tokens.
 *
 * Both are RS256 JWTs from a published key set, and the dangerous parts are the
 * same for each — pinning the algorithm, finding the key by `kid`, decoding
 * base64url without throwing. Having one copy means a fix lands in both.
 *
 * The claim checks are *not* here. What `aud` and `iss` must equal is specific
 * to each issuer, and a generic "validate the claims" helper is how a check
 * ends up looser than the caller thinks it is.
 */

export interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

/** Supplies the current JWKS; null means unavailable, which fails closed. */
export type GetJwks = () => Promise<readonly Jwk[] | null>;

/** Key sets rotate slowly; trust a fetched one this long. */
const JWKS_TTL_MS = 10 * 60_000;

export interface JwtHeader {
  alg: string;
  kid: string;
}

export type VerifyResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: "invalid" | "jwks-unavailable" };

/**
 * Check a token's signature and return its payload, unexamined.
 *
 * The algorithm is pinned to RS256 rather than read from the token's own
 * header, which is how `alg: "none"` downgrade attacks work. Nothing throws:
 * every malformed input is a negative result.
 *
 * The payload is returned raw because the caller owns the claim checks. A
 * verified signature only says the issuer minted this; whether it was minted
 * for *you* is `aud`, and that is the caller's business.
 */
export async function verifyRs256(
  token: string,
  getJwks: GetJwks,
): Promise<VerifyResult> {
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
  if (header === null || header.alg !== "RS256") {
    return { ok: false, reason: "invalid" };
  }
  const payload = decodeJson(payloadB64, (raw) => (isRecord(raw) ? raw : null));
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
  const valid = await verifySignature({
    jwks,
    kid: header.kid,
    signature,
    data: new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  });
  return valid ? { ok: true, payload } : { ok: false, reason: "invalid" };
}

export async function verifySignature({
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
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      signature,
      data,
    );
  } catch {
    // A malformed key or signature is a verification failure, not a 500.
    return false;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function asJwtHeader(raw: unknown): JwtHeader | null {
  if (!isRecord(raw)) return null;
  const { alg, kid } = raw;
  if (typeof alg !== "string" || typeof kid !== "string" || !kid) return null;
  return { alg, kid };
}

export function asJwks(raw: unknown): readonly Jwk[] | null {
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

export function decodeJson<T>(
  segment: string,
  validate: (raw: unknown) => T | null,
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

export function base64UrlToBytes(input: string): Uint8Array | null {
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

export function base64UrlToString(input: string): string | null {
  const bytes = base64UrlToBytes(input);
  if (bytes === null) return null;
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// --- Production JWKS fetchers (module-cached per URL) --------------------------

const fetchers = new Map<string, GetJwks>();

/**
 * The JWKS supplier for a key-set URL, cached at module scope so the keys
 * survive across requests in a warm Worker. Returns null on any fetch or parse
 * failure with no valid cache, which every caller turns into a refusal.
 */
export function jwksFetcher(url: string): GetJwks {
  const existing = fetchers.get(url);
  if (existing !== undefined) {
    return existing;
  }
  let cache: { keys: readonly Jwk[]; expiresAt: number } | null = null;
  const fetcher: GetJwks = async () => {
    if (cache !== null && Date.now() < cache.expiresAt) {
      return cache.keys;
    }
    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        console.warn(`JWKS at ${url} returned ${response.status}`);
        return null;
      }
      const keys = asJwks(await response.json());
      if (keys === null) {
        console.warn(`JWKS at ${url} failed validation`);
        return null;
      }
      cache = { keys, expiresAt: Date.now() + JWKS_TTL_MS };
      return keys;
    } catch (e) {
      console.warn(`JWKS fetch failed for ${url}: ${String(e)}`);
      return null;
    }
  };
  fetchers.set(url, fetcher);
  return fetcher;
}

// --- Cookies ------------------------------------------------------------------

export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (cookieHeader === null) {
    return null;
  }
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
