import axios from "axios";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { jwt } from "@/test/jwt";
import {
    cookieStore,
    discovery,
    jar,
    provider,
    Redirect,
    redirectOf,
    setCookies,
    setUp,
} from "@/test/routes";

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => ({
    redirect: (url: string) => {
        throw new Redirect(url);
    },
}));

const pending = {
    authState: "state-1",
    authProvider: "mock",
    authVerifier: "verifier-1",
    authNonce: "nonce-1",
};
const claims = {
    iss: discovery.issuer,
    aud: "client",
    sub: "a",
    nonce: "nonce-1",
    exp: Math.floor(Date.now() / 1000) + 300,
};
const idToken = jwt(claims);
const tokens = {
    access_token: "access",
    id_token: idToken,
    token_type: "Bearer",
    expires_in: 3600,
};

async function callback(query: string, tokenResponse: unknown = tokens) {
    const post = vi
        .spyOn(axios, "post")
        .mockResolvedValue({ status: 200, data: tokenResponse });
    const { GET } = await import("./route");
    const url = await redirectOf(() =>
        GET(
            new NextRequest(
                `https://app.example.org/auth/api/callback${query}`,
            ),
        ),
    );
    return { url, post };
}

describe("GET /auth/api/callback", () => {
    it("exchanges the code and starts the session", async () => {
        setUp(pending);
        const { url, post } = await callback("?code=c1&state=state-1");
        expect(url).toBe("/dashboard");

        const [endpoint, body, options] = post.mock.calls[0];
        expect(endpoint).toBe(`${provider.issuer}/token`);
        expect(Object.fromEntries(body as URLSearchParams)).toEqual({
            grant_type: "authorization_code",
            code: "c1",
            redirect_uri: "https://app.example.org/auth/api/callback",
            client_id: "client",
            client_secret: "client-secret",
            code_verifier: "verifier-1",
        });
        expect(options?.timeout).toBe(10000);
        // other statuses are failures, e.g. errors with a JSON body
        expect(options?.validateStatus?.(200)).toBe(true);
        expect(options?.validateStatus?.(400)).toBe(false);

        expect(jar.get("access_token")).toMatchObject({
            value: "access",
            maxAge: 3600,
            sameSite: "lax",
        });
        expect(jar.get("access_token")?.httpOnly).toBeUndefined();
        expect(jar.get("id_token")).toMatchObject({
            value: idToken,
            httpOnly: true,
        });
        expect(jar.get("login_provider")).toMatchObject({
            value: "mock",
            httpOnly: true,
        });
        // the state is used up
        for (const name of Object.keys(pending))
            expect(jar.has(name)).toBe(false);
    });

    it("returns to the app's path kept at the start of the login", async () => {
        setUp({ ...pending, authReturnTo: "/invitations" });
        expect((await callback("?code=c1&state=state-1")).url).toBe(
            "/invitations",
        );
        expect(jar.has("authReturnTo")).toBe(false);
    });

    it("ignores a path to return to that isn't the app's", async () => {
        setUp({ ...pending, authReturnTo: "//evil.example.org/" });
        expect((await callback("?code=c1&state=state-1")).url).toBe(
            "/dashboard",
        );
        expect(jar.has("authReturnTo")).toBe(false);
    });

    it("starts in user mode", async () => {
        setUp({ ...pending, admin_mode: "1" });
        expect((await callback("?code=c1&state=state-1")).url).toBe(
            "/dashboard",
        );
        expect(jar.has("admin_mode")).toBe(false);
    });

    it.each([
        ["no state", "?code=c1", pending],
        ["another state", "?code=c1&state=forged", pending],
        ["no pending login", "?code=c1&state=state-1", {}],
        // e.g. a login started by an earlier version of the app
        [
            "a login without PKCE",
            "?code=c1&state=state-1",
            { ...pending, authVerifier: undefined },
        ],
        [
            "a login without a nonce",
            "?code=c1&state=state-1",
            { ...pending, authNonce: undefined },
        ],
    ])("rejects %s and keeps a pending login", async (_, query, cookies) => {
        setUp(cookies);
        const { url, post } = await callback(query);
        expect(url).toBe("/auth/error?type=state");
        expect(post).not.toHaveBeenCalled();
        expect(jar.get("authState")?.value).toBe(
            (cookies as Record<string, string>).authState,
        );
    });

    it("uses up the state of a denied login", async () => {
        setUp(pending);
        const { url } = await callback("?error=access_denied&state=state-1");
        expect(url).toBe("/auth/error?type=params");
        expect(jar.has("authState")).toBe(false);
        // replaying the state with a code fails
        expect((await callback("?code=c1&state=state-1")).url).toBe(
            "/auth/error?type=state",
        );
    });

    it.each([
        ["an unknown provider", { ...pending, authProvider: "other" }],
        ["no provider", { ...pending, authProvider: undefined }],
    ])("rejects %s", async (_, cookies) => {
        setUp(cookies);
        expect((await callback("?code=c1&state=state-1")).url).toBe(
            "/auth/error?type=provider",
        );
    });

    it.each([
        ["no ID token", { ...tokens, id_token: undefined }, "id_token"],
        ["another token type", { ...tokens, token_type: "DPoP" }, "token_type"],
        ["an expired token", { ...tokens, expires_in: 0 }, "expires_in"],
        [
            "an invalid lifetime",
            { ...tokens, expires_in: "soon" },
            "expires_in",
        ],
        ["no JSON object", "<html>", "body"],
    ])("fails on %s, naming the field only", async (_, data, field) => {
        setUp(pending);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const { url } = await callback("?code=c1&state=state-1", data);
        expect(url).toBe("/auth/error?type=internal");
        expect(log).toHaveBeenCalledWith(
            "Login with mock failed:",
            `Invalid token response: ${field}`,
        );
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/access|secret/);
        expect(jar.has("access_token")).toBe(false);
    });

    it.each([
        ["another nonce", jwt({ ...claims, nonce: "nonce-2" }), "nonce"],
        ["no nonce", jwt({ ...claims, nonce: undefined }), "nonce"],
        ["another issuer", jwt({ ...claims, iss: "https://evil" }), "iss"],
        ["another audience", jwt({ ...claims, aud: "other" }), "aud"],
        ["no JWT", "id", "Invalid ID token"],
    ])("fails on an ID token with %s", async (_, id_token, message) => {
        setUp(pending);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const { url } = await callback("?code=c1&state=state-1", {
            ...tokens,
            id_token,
        });
        expect(url).toBe("/auth/error?type=internal");
        expect(log).toHaveBeenCalledWith(
            "Login with mock failed:",
            expect.stringContaining(message),
        );
        const logged = JSON.stringify(log.mock.calls);
        for (const secret of [tokens.access_token, "nonce-1"])
            expect(logged).not.toContain(secret);
        expect(jar.has("access_token")).toBe(false);
        expect(jar.has("id_token")).toBe(false);
    });

    it("accepts the provider's issuer in the response", async () => {
        setUp(pending);
        const iss = encodeURIComponent(discovery.issuer);
        expect((await callback(`?code=c1&state=state-1&iss=${iss}`)).url).toBe(
            "/dashboard",
        );
    });

    it("compares the issuer with the discovered one, as LS Login's", async () => {
        setUp(pending);
        const issuer = `${discovery.issuer}/`;
        vi.spyOn(axios, "get").mockResolvedValue({
            data: { ...discovery, issuer },
        });
        const { url } = await callback(
            `?code=c1&state=state-1&iss=${encodeURIComponent(issuer)}`,
            { ...tokens, id_token: jwt({ ...claims, iss: issuer }) },
        );
        expect(url).toBe("/dashboard");
    });

    it.each([
        ["another issuer", "&iss=https%3A%2F%2Fevil.example.org", false],
        [
            "an issuer with another trailing slash",
            `&iss=${encodeURIComponent(`${discovery.issuer}/`)}`,
            false,
        ],
        ["no issuer from a provider that sends one", "", true],
    ])("rejects %s", async (_, iss, supported) => {
        setUp(pending);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(axios, "get").mockResolvedValue({
            data: {
                ...discovery,
                authorization_response_iss_parameter_supported: supported,
            },
        });
        const { url, post } = await callback(`?code=c1&state=state-1${iss}`);
        expect(url).toBe("/auth/error?type=issuer");
        expect(log).toHaveBeenCalledWith(
            "Login with mock failed:",
            expect.stringMatching(
                `^Unexpected iss .+, expected ${discovery.issuer}$`,
            ),
        );
        // the code may be another provider's
        expect(post).not.toHaveBeenCalled();
        expect(jar.has("authState")).toBe(false);
    });

    it("fails when the discovery fails", async () => {
        setUp(pending);
        vi.spyOn(axios, "get").mockRejectedValue(new Error("down"));
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const { url, post } = await callback("?code=c1&state=state-1");
        expect(url).toBe("/auth/error?type=internal");
        expect(log).toHaveBeenCalledWith("Login with mock failed:", "down");
        expect(post).not.toHaveBeenCalled();
    });

    it("fails when the token request fails", async () => {
        setUp(pending);
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(axios, "post").mockRejectedValue(new Error("down"));
        const { GET } = await import("./route");
        expect(
            await redirectOf(() =>
                GET(
                    new NextRequest(
                        "https://app.example.org/auth/api/callback?code=c1&state=state-1",
                    ),
                ),
            ),
        ).toBe("/auth/error?type=internal");
    });

    it.each([
        ["a string", "7200", 7200],
        ["a fraction", 299.5, 299],
        ["a longer lifetime than 12 hours", 86400, 43200],
        ["no lifetime", undefined, 43200],
        ["null", null, 43200],
    ])("sets the session's lifetime from %s", async (_, expiresIn, maxAge) => {
        setUp(pending);
        await callback("?code=c1&state=state-1", {
            ...tokens,
            expires_in: expiresIn,
        });
        for (const name of ["access_token", "id_token", "login_provider"])
            expect(jar.get(name)?.maxAge).toBe(maxAge);
    });

    it("accepts a lower-case token type, or none", async () => {
        for (const token_type of ["bearer", undefined]) {
            setUp(pending);
            const { url } = await callback("?code=c1&state=state-1", {
                ...tokens,
                token_type,
            });
            expect(url).toBe("/dashboard");
        }
        expect(setCookies.some((val) => val.name === "access_token")).toBe(
            true,
        );
    });
});
