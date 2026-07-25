/**
 * Cloudflare Access gate, fail-closed.
 *
 * Access sits in front of the Worker and forwards a signed assertion; the Worker
 * verifies it rather than trusting the header, so a request that reaches the
 * origin directly can't impersonate a user.
 *
 * The policy mirrors callback-box's pub-worker:
 *  - Access not configured (no team domain / aud) → 404. The gated surface isn't
 *    set up here, so treat it as missing rather than advertising it with a 401.
 *  - Missing, invalid, expired or wrong-`aud` assertion → 401. Access should
 *    have supplied a valid one, so its absence means misconfiguration or a
 *    bypass attempt. Never serve.
 */

export interface AccessConfig {
  teamDomain: string;
  aud: string;
}

export type AuthResult =
  | { ok: true; email: string }
  | { ok: false; response: Response };

export const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";

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

export async function authenticate(
  request: Request,
  env: { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string }
): Promise<AuthResult> {
  const config = accessConfig(env);
  if (!config) {
    return { ok: false, response: new Response("Not found", { status: 404 }) };
  }
  const assertion = request.headers.get(ACCESS_HEADER);
  if (!assertion) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  }
  const verified = await verifyAssertion(assertion, config);
  if (!verified) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  }
  return { ok: true, email: verified };
}

/**
 * NOT YET IMPLEMENTED — returns null (which the caller turns into a 401), so
 * this fails closed rather than admitting anyone while it is a stub.
 *
 * The real implementation fetches the team's JWKS
 * (`https://<teamDomain>/cdn-cgi/access/certs`), verifies the RS256 signature
 * with WebCrypto, and checks `aud`, `iss` and expiry before returning the
 * `email` claim. callback-box's pub-worker (src/access.ts) has a working
 * version to port.
 */
async function verifyAssertion(
  _assertion: string,
  _config: AccessConfig
): Promise<string | null> {
  return null;
}
