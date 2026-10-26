import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { jwt } from "@/test/jwt";
import { idTokenNonce, pkceChallenge, randomSecret } from "./login-flow";

describe("randomSecret", () => {
    it("makes a new URL-safe secret of 256 bits each time", () => {
        const secret = randomSecret();
        expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(randomSecret()).not.toBe(secret);
    });
});

describe("pkceChallenge", () => {
    it("is the SHA-256 hash of the verifier, base64url-encoded", () => {
        // the example of RFC 7636, appendix B
        expect(
            pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
        ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
        expect(pkceChallenge("x")).toBe(
            createHash("sha256").update("x").digest("base64url"),
        );
    });
});

describe("idTokenNonce", () => {
    it("reads the nonce of an ID token", () => {
        expect(idTokenNonce(jwt({ sub: "a", nonce: "n-1" }))).toBe("n-1");
    });

    it.each([
        ["no nonce", jwt({ sub: "a" })],
        ["a nonce that isn't a string", jwt({ nonce: 1 })],
        ["claims that aren't an object", jwt(["n-1"])],
    ])("is undefined for %s", (_, token) => {
        expect(idTokenNonce(token)).toBeUndefined();
    });

    it.each([
        ["no JWT", "id"],
        ["a payload that isn't JSON", `e30.${"x".repeat(8)}.sig`],
        ["too many parts", `${jwt({ nonce: "n-1" })}.more`],
    ])("rejects %s", (_, token) => {
        expect(() => idTokenNonce(token)).toThrow("Invalid ID token");
    });
});
