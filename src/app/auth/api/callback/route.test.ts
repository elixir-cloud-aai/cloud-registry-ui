import axios from "axios";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
    cookieStore,
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

const pending = { authState: "state-1", authProvider: "mock" };
const tokens = {
    access_token: "access",
    id_token: "id",
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
            value: "id",
            httpOnly: true,
        });
        expect(jar.get("login_provider")).toMatchObject({
            value: "mock",
            httpOnly: true,
        });
        // the state is used up
        expect(jar.has("authState")).toBe(false);
        expect(jar.has("authProvider")).toBe(false);
    });

    it.each([
        ["no state", "?code=c1", pending],
        ["another state", "?code=c1&state=forged", pending],
        ["no pending login", "?code=c1&state=state-1", {}],
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
        ["no provider", { authState: "state-1" }],
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
