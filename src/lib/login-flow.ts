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

/** @description cookie of the app's path to return to after a login */
const returnCookie = "authReturnTo";

/** @description cookies to delete when a login ends, or on logout */
const endedLoginCookies = [...loginCookies, returnCookie] as const;

/** @description allowed difference of clocks, in milliseconds */
const clockSkew = 60_000;

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
 * the app (`aud`, and `azp` if present or with several audiences), not
 * expired (`exp`, with a minute for differing clocks), with the login's
 * nonce. The signature isn't checked:
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
    const { iss, aud, azp, exp, nonce } = claims as Record<string, unknown>;
    if (iss !== expected.issuer) throw new Error("ID token with another iss");
    const audiences = Array.isArray(aud) ? aud : [aud];
    if (!audiences.includes(expected.clientId))
        throw new Error("ID token with another aud");
    if (
        (azp !== undefined || audiences.length > 1) &&
        azp !== expected.clientId
    )
        throw new Error("ID token with another azp");
    if (typeof exp !== "number" || exp * 1000 + clockSkew <= Date.now())
        throw new Error("ID token with another exp");
    if (nonce !== expected.nonce)
        throw new Error("ID token with another nonce");
}

// any origin of the app: paths are compared, not hosts
const appBase = "https://app.invalid";

/**
 * Get the app's path to return to after a login, e.g. the page of an
 * invitation; never another site's URL (an open redirect) or a page of the
 * login itself
 * @param value Path, from a query parameter or the cookie
 * @returns The path and query, without the fragment, if the value is a
 * path of the app outside `/auth`
 */
function returnPath(value: string | null | undefined) {
    // a single slash first: `//host` and `/\host` are other sites' URLs;
    // no backslashes or control characters, which browsers drop or change
    if (
        !value ||
        value.length > 1024 ||
        !/^\/(?![/\\])/.test(value) ||
        // biome-ignore lint/suspicious/noControlCharactersInRegex: rejects them
        /[\\\u0000-\u001f\u007f]/.test(value)
    )
        return undefined;
    // resolves dot segments, which can make the path start with `//`
    // again (e.g. `/.//host`): checked once more
    const url = new URL(value, appBase);
    if (
        url.pathname.startsWith("//") ||
        url.pathname === "/auth" ||
        url.pathname.startsWith("/auth/")
    )
        return undefined;
    return `${url.pathname}${url.search}`;
}

export {
    checkIdToken,
    endedLoginCookies,
    loginCookies,
    pkceChallenge,
    randomSecret,
    returnCookie,
    returnPath,
};
