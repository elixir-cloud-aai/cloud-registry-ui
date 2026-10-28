/**
 * @description ID tokens in tests
 */

/**
 * A JWT with the given claims, unsigned
 * @param claims Claims of the payload
 * @returns The token
 */
export const jwt = (claims: unknown) =>
    ["{}", JSON.stringify(claims), "sig"]
        .map((val) => Buffer.from(val).toString("base64url"))
        .join(".");
