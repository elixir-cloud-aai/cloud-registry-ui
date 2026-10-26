/**
 * @description secrets of a login and checks of its result: the state,
 * PKCE (RFC 7636) and the nonce of OpenID Connect; server only
 */
import { createHash, randomBytes } from "node:crypto";

/** @description cookies of a pending login, deleted when it ends */
const loginCookies = [
    "authState",
    "authProvider",
    "authVerifier",
    "authNonce",
] as const;

/**
 * Make a new secret for a login, e.g. a state, PKCE code verifier or nonce
 * @returns 256 random bits, base64url-encoded (43 characters)
 */
function randomSecret() {
    return randomBytes(32).toString("base64url");
}

/**
 * Get the PKCE code challenge of a code verifier, for the method `S256`
 * @param verifier Code verifier
 * @returns The verifier's SHA-256 hash, base64url-encoded
 */
function pkceChallenge(verifier: string) {
    return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Check that an ID token is of this login: of the provider (`iss`), for
 * the app (`aud`), with the login's nonce. The signature isn't checked:
 * the app gets the token straight from the provider's token endpoint, over
 * TLS (OpenID Connect Core, section 3.1.3.7), and reads no other claims
 * @param idToken ID token, a JWT
 * @param expected The provider's issuer, as discovered, the app's client
 * ID, and the login's nonce
 * @throws Error naming the claim that doesn't match, or if the token isn't
 * a JWT with a JSON object as payload
 */
function checkIdToken(
    idToken: string,
    expected: { issuer: string; clientId: string; nonce: string },
) {
    const parts = idToken.split(".");
    let claims: unknown;
    try {
        if (parts.length !== 3) throw new Error();
        claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    } catch {
        throw new Error("Invalid ID token");
    }
    if (claims === null || typeof claims !== "object" || Array.isArray(claims))
        throw new Error("Invalid ID token");
    const { iss, aud, nonce } = claims as Record<string, unknown>;
    if (iss !== expected.issuer) throw new Error("ID token with another iss");
    if (!(Array.isArray(aud) ? aud : [aud]).includes(expected.clientId))
        throw new Error("ID token with another aud");
    if (nonce !== expected.nonce)
        throw new Error("ID token with another nonce");
}

export { checkIdToken, loginCookies, pkceChallenge, randomSecret };
