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
 * Read the nonce of an ID token. The token isn't verified: the app gets it
 * straight from the provider's token endpoint, over TLS (OpenID Connect
 * Core, section 3.1.3.7)
 * @param idToken ID token, a JWT
 * @returns The `nonce` claim, or undefined if there is no string nonce
 * @throws Error if the token isn't a JWT with a JSON payload
 */
function idTokenNonce(idToken: string) {
    const parts = idToken.split(".");
    let claims: unknown;
    try {
        if (parts.length !== 3) throw new Error();
        claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    } catch {
        throw new Error("Invalid ID token");
    }
    const nonce =
        claims !== null && typeof claims === "object" && !Array.isArray(claims)
            ? (claims as { nonce?: unknown }).nonce
            : undefined;
    return typeof nonce === "string" ? nonce : undefined;
}

export { idTokenNonce, loginCookies, pkceChallenge, randomSecret };
