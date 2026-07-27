/**
 * Sign in with Google.
 *
 * Cloudflare Access was doing the identity work up to now, and it is the wrong
 * shape for a public game: it is an allowlist billed per seat, sized for
 * employees. This is the same job done by the app — a standard OIDC
 * authorization-code flow, ending in a signed session cookie the Worker mints
 * itself.
 *
 * The seam it plugs into already existed. `authenticate()` returns a verified
 * email and everything downstream is named after it, so swapping who vouches
 * for that email changes one function rather than the app.
 *
 * What is deliberately not here: no access token is kept, no refresh token is
 * requested, and nothing but the email is read out of the ID token. The scopes
 * asked for are `openid email`. A game does not need to know your name.
 */

import {
  base64UrlToString,
  bytesToBase64Url,
  isRecord,
  jwksFetcher,
  readCookie,
  verifyRs256,
  type GetJwks,
} from "./jwt";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** HMAC key for the cookies this mints. Any long random string. */
  cookieSecret: string;
}

export const SESSION_COOKIE = "intra_session";
/** Carries the PKCE verifier and CSRF nonce between the two legs of the flow. */
export const STATE_COOKIE = "intra_oauth";
export const CALLBACK_PATH = "/auth/callback";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
/** The window to finish a login in. Long enough to read a consent screen. */
const STATE_TTL_MS = 10 * 60_000;
const CLOCK_SKEW_MS = 60_000;

/** Google config, or null when this deployment hasn't been set up for it. */
export function googleConfig(env: {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
}): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const cookieSecret = env.SESSION_SECRET?.trim();
  if (!clientId || !clientSecret || !cookieSecret) {
    return null;
  }
  return { clientId, clientSecret, cookieSecret };
}

// --- Sealed values ------------------------------------------------------------

/**
 * `payload.signature`, where the signature is HMAC-SHA256 over the payload.
 *
 * This is not encryption and isn't meant to be: the contents are an email and
 * an expiry, neither secret. What the signature buys is that a browser cannot
 * edit either one, which is the whole security property of the session cookie.
 */
async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function seal(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const body = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(body),
  );
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/**
 * The payload of a sealed value, or null.
 *
 * Verification goes through `crypto.subtle.verify` rather than comparing
 * strings, so it is constant-time by construction. An `exp` in the payload is
 * enforced here — a caller that forgot to check it would otherwise hold a
 * forever-valid cookie.
 */
export async function unseal(
  token: string | null,
  secret: string,
  now = Date.now(),
): Promise<Record<string, unknown> | null> {
  if (!token) {
    return null;
  }
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const bytes = base64UrlToBytesSafe(signature);
  if (bytes === null) {
    return null;
  }
  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      bytes,
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) {
    return null;
  }
  const text = base64UrlToString(body);
  if (text === null) {
    return null;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(payload)) {
    return null;
  }
  const exp = payload.exp;
  if (typeof exp !== "number" || now >= exp) {
    return null;
  }
  return payload;
}

function base64UrlToBytesSafe(input: string): Uint8Array | null {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function cookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  // SameSite=Lax rather than Strict: the browser arrives back from Google's
  // consent screen by top-level navigation, and Strict would withhold the state
  // cookie on exactly that request.
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/** Localhost is served over plain http, where a Secure cookie is dropped. */
function isSecure(url: URL): boolean {
  return url.protocol === "https:";
}

// --- The flow -----------------------------------------------------------------

function randomToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

/**
 * Where to send the browser after a successful login.
 *
 * Only same-site paths are honoured. A `next` of `https://elsewhere/` would
 * make this an open redirector, which is a phishing primitive: an attacker gets
 * to send a victim a link on your domain that lands on theirs.
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

/** Leg one: bounce the browser to Google. */
export async function startGoogleLogin(
  request: Request,
  config: GoogleConfig,
  now = Date.now(),
): Promise<Response> {
  const url = new URL(request.url);
  const verifier = randomToken();
  const nonce = randomToken();
  const next = safeNext(url.searchParams.get("next"));
  const state = await seal(
    { nonce, verifier, next, exp: now + STATE_TTL_MS },
    config.cookieSecret,
  );

  const authorize = new URL(AUTHORIZE_URL);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", `${url.origin}${CALLBACK_PATH}`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email");
  authorize.searchParams.set("state", nonce);
  authorize.searchParams.set("code_challenge", await pkceChallenge(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  // Without this Google silently reuses a previous consent for accounts that
  // have one, which makes "sign in as someone else" impossible.
  authorize.searchParams.set("prompt", "select_account");

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Set-Cookie": cookie(
        STATE_COOKIE,
        state,
        Math.floor(STATE_TTL_MS / 1000),
        isSecure(url),
      ),
    },
  });
}

export interface TokenResponse {
  id_token?: unknown;
}

/** Swaps the code for tokens. Injectable so the flow is testable offline. */
export type ExchangeFn = (params: {
  code: string;
  verifier: string;
  redirectUri: string;
  config: GoogleConfig;
}) => Promise<TokenResponse | null>;

const exchangeWithGoogle: ExchangeFn = async ({
  code,
  verifier,
  redirectUri,
  config,
}) => {
  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!response.ok) {
      console.warn(`Google token exchange returned ${response.status}`);
      return null;
    }
    return (await response.json()) as TokenResponse;
  } catch (e) {
    console.warn(`Google token exchange failed: ${String(e)}`);
    return null;
  }
};

/**
 * The verified email in a Google ID token, or null.
 *
 * The signature is checked against Google's published keys even though the
 * token arrived over TLS from Google's own token endpoint, where OIDC allows
 * skipping it. The code is written and tested either way, and "we trusted the
 * transport" is a sentence that ages badly.
 *
 * `email_verified` matters as much as the signature: a Google account can carry
 * an unverified address, and treating one as an identity would let someone
 * claim an email they don't control.
 */
export async function emailFromIdToken(
  idToken: unknown,
  config: GoogleConfig,
  getJwks: GetJwks = jwksFetcher(GOOGLE_JWKS_URL),
  now = Date.now(),
): Promise<string | null> {
  if (typeof idToken !== "string" || !idToken) {
    return null;
  }
  const verified = await verifyRs256(idToken, getJwks);
  if (!verified.ok) {
    return null;
  }
  const {
    iss,
    aud,
    exp,
    email,
    email_verified: emailVerified,
  } = verified.payload;
  if (typeof iss !== "string" || !GOOGLE_ISSUERS.includes(iss)) {
    return null;
  }
  if (aud !== config.clientId) {
    return null;
  }
  if (typeof exp !== "number" || now >= exp * 1000 + CLOCK_SKEW_MS) {
    return null;
  }
  if (emailVerified !== true) {
    return null;
  }
  if (typeof email !== "string" || !email) {
    return null;
  }
  return email;
}

/** Leg two: Google sends the browser back here with a code. */
export async function completeGoogleLogin(
  request: Request,
  config: GoogleConfig,
  deps: { exchange?: ExchangeFn; getJwks?: GetJwks; now?: number } = {},
): Promise<Response> {
  const now = deps.now ?? Date.now();
  const url = new URL(request.url);
  const fail = (why: string) =>
    new Response(`Sign-in failed: ${why}`, {
      status: 400,
      headers: {
        // Whatever went wrong, the half-finished flow is over.
        "Set-Cookie": cookie(STATE_COOKIE, "", 0, isSecure(url)),
      },
    });

  const state = await unseal(
    readCookie(request.headers.get("Cookie"), STATE_COOKIE),
    config.cookieSecret,
    now,
  );
  if (state === null) {
    return fail("the sign-in took too long, please try again");
  }
  // The returned `state` proves this callback belongs to the flow this browser
  // started, rather than one an attacker started and pasted at the victim.
  if (
    typeof state.nonce !== "string" ||
    url.searchParams.get("state") !== state.nonce
  ) {
    return fail("state did not match");
  }
  const code = url.searchParams.get("code");
  if (!code || typeof state.verifier !== "string") {
    return fail("no authorization code");
  }

  const exchange = deps.exchange ?? exchangeWithGoogle;
  const tokens = await exchange({
    code,
    verifier: state.verifier,
    redirectUri: `${url.origin}${CALLBACK_PATH}`,
    config,
  });
  if (tokens === null) {
    return fail("could not reach Google");
  }
  const email = await Promise.resolve(
    deps.getJwks
      ? emailFromIdToken(tokens.id_token, config, deps.getJwks, now)
      : emailFromIdToken(tokens.id_token, config, undefined, now),
  );
  if (email === null) {
    return fail("Google did not confirm a verified email address");
  }

  const session = await seal(
    { email, exp: now + SESSION_TTL_MS },
    config.cookieSecret,
  );
  const secure = isSecure(url);
  const headers = new Headers({ Location: safeNext(asString(state.next)) });
  headers.append(
    "Set-Cookie",
    cookie(SESSION_COOKIE, session, Math.floor(SESSION_TTL_MS / 1000), secure),
  );
  headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0, secure));
  return new Response(null, { status: 302, headers });
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Drop the session cookie. */
export function googleLogout(request: Request): Response {
  const url = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: safeNext(url.searchParams.get("next")),
      "Set-Cookie": cookie(SESSION_COOKIE, "", 0, isSecure(url)),
    },
  });
}

/** The signed-in email on this request, or null. */
export async function verifyGoogleSession(
  request: Request,
  config: GoogleConfig,
  now = Date.now(),
): Promise<string | null> {
  const payload = await unseal(
    readCookie(request.headers.get("Cookie"), SESSION_COOKIE),
    config.cookieSecret,
    now,
  );
  if (payload === null) {
    return null;
  }
  return asString(payload.email);
}
