import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { jwt } from "@/test/jwt";
import {
    checkIdToken,
    pkceChallenge,
    randomSecret,
    returnCookie,
    returnPath,
} from "./login-flow";

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

describe("checkIdToken", () => {
    const expected = {
        issuer: "https://login.example.org/oidc/",
        clientId: "client",
        nonce: "n-1",
    };
    const now = Math.floor(Date.now() / 1000);
    const claims = {
        iss: expected.issuer,
        aud: "client",
        sub: "a",
        nonce: "n-1",
        exp: now + 300,
    };

    it.each([
        ["an audience", claims],
        [
            "a list of audiences and this client as authorized party",
            { ...claims, aud: ["other", "client"], azp: "client" },
        ],
        ["this client as authorized party", { ...claims, azp: "client" }],
        // clocks may differ a little
        ["an expiry a few seconds ago", { ...claims, exp: now - 30 }],
    ])("accepts an ID token of this login with %s", (_, val) => {
        expect(() => checkIdToken(jwt(val), expected)).not.toThrow();
    });

    it.each([
        ["another nonce", { nonce: "n-2" }, "nonce"],
        ["no nonce", { nonce: undefined }, "nonce"],
        ["another issuer", { iss: "https://login.example.org/oidc" }, "iss"],
        ["another audience", { aud: "other" }, "aud"],
        ["a list without the client", { aud: ["other"] }, "aud"],
        ["no audience", { aud: undefined }, "aud"],
        ["another authorized party", { azp: "other" }, "azp"],
        [
            "a list of audiences without authorized party",
            { aud: ["other", "client"] },
            "azp",
        ],
        ["an expiry long ago", { exp: now - 120 }, "exp"],
        ["no expiry", { exp: undefined }, "exp"],
        ["an expiry that isn't a number", { exp: `${now + 300}` }, "exp"],
    ])("rejects an ID token with %s", (_, change, claim) => {
        expect(() =>
            checkIdToken(jwt({ ...claims, ...change }), expected),
        ).toThrow(`ID token with another ${claim}`);
    });

    it.each([
        ["no JWT", "id"],
        ["a payload that isn't JSON", `e30.${"x".repeat(8)}.sig`],
        ["too many parts", `${jwt(claims)}.more`],
        ["claims that aren't an object", jwt(["n-1"])],
        ["null claims", jwt(null)],
    ])("rejects %s", (_, token) => {
        expect(() => checkIdToken(token, expected)).toThrow("Invalid ID token");
    });
});

describe("returnPath", () => {
    it("has a cookie of its own", () => {
        expect(returnCookie).toBe("authReturnTo");
    });

    it.each([
        ["/invitations", "/invitations"],
        ["/dashboard/services?page=2", "/dashboard/services?page=2"],
        // the fragment stays in the browser
        ["/invitations#token", "/invitations"],
        ["/a/../dashboard", "/dashboard"],
    ])("keeps the app's path %j", (value, path) => {
        expect(returnPath(value)).toBe(path);
    });

    it.each([
        null,
        undefined,
        "",
        "dashboard",
        "https://evil.example.org/",
        "//evil.example.org/",
        "/\\evil.example.org/",
        "/\\/evil.example.org/",
        "/a\nb",
        "/a\u0000",
        "/auth/login",
        "/auth/api/login-redirect?provider=x",
        "/auth",
        `/${"a".repeat(1024)}`,
    ])("rejects %j", (value) => {
        expect(returnPath(value)).toBeUndefined();
    });
});
