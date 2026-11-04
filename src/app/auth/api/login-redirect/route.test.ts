import axios from "axios";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { loginCookies, pkceChallenge } from "@/lib/login-flow";
import {
    cookieStore,
    jar,
    provider,
    Redirect,
    redirectOf,
    setUp,
} from "@/test/routes";

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => ({
    redirect: (url: string) => {
        throw new Redirect(url);
    },
}));

async function login(query = "") {
    const { GET } = await import("./route");
    return GET(
        new NextRequest(
            `https://app.example.org/auth/api/login-redirect${query}`,
        ),
    );
}

describe("GET /auth/api/login-redirect", () => {
    it("sends the user to the provider with a new state, PKCE and a nonce", async () => {
        setUp();
        const response = await login("?provider=mock");
        const location = new URL(response.headers.get("location") ?? "");
        expect(`${location.origin}${location.pathname}`).toBe(
            `${provider.issuer}/authorize`,
        );
        const state = jar.get("authState");
        const verifier = jar.get("authVerifier")?.value ?? "";
        const nonce = jar.get("authNonce")?.value;
        expect(Object.fromEntries(location.searchParams)).toEqual({
            prompt: "login",
            response_type: "code",
            client_id: "client",
            redirect_uri: "https://app.example.org/auth/api/callback",
            scope: "openid profile email",
            state: state?.value,
            code_challenge: pkceChallenge(verifier),
            code_challenge_method: "S256",
            nonce,
        });
        expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
        for (const name of loginCookies)
            expect(jar.get(name)).toMatchObject({
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                maxAge: 1800,
            });
        expect(jar.get("authProvider")?.value).toBe("mock");
    });

    it("makes new secrets for each login", async () => {
        setUp();
        await login("?provider=mock");
        const first = ["authState", "authVerifier", "authNonce"].map(
            (name) => jar.get(name)?.value,
        );
        await login("?provider=mock");
        for (const [i, name] of [
            "authState",
            "authVerifier",
            "authNonce",
        ].entries())
            expect(jar.get(name)?.value).not.toBe(first[i]);
    });

    it("uses the only provider without an ID", async () => {
        setUp();
        expect((await login()).status).toBe(307);
    });

    it("keeps the app's path to return to after the login", async () => {
        setUp();
        await login("?provider=mock&next=%2Finvitations%23token");
        expect(jar.get("authReturnTo")).toMatchObject({
            value: "/invitations",
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 1800,
        });
    });

    it.each([
        "",
        "&next=https%3A%2F%2Fevil.example.org%2F",
        "&next=%2F%2Fevil.example.org",
    ])("forgets an earlier path to return to (%j)", async (next) => {
        setUp({ authReturnTo: "/invitations" });
        await login(`?provider=mock${next}`);
        expect(jar.has("authReturnTo")).toBe(false);
    });

    it("rejects unknown providers", async () => {
        setUp();
        expect(await redirectOf(() => login("?provider=other"))).toBe(
            "/auth/error?type=provider",
        );
        expect(jar.size).toBe(0);
    });

    it("reports a failed discovery without starting a login", async () => {
        setUp();
        vi.spyOn(axios, "get").mockRejectedValue(new Error("down"));
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(await redirectOf(() => login("?provider=mock"))).toBe(
            "/auth/error?type=internal",
        );
        expect(log).toHaveBeenCalledWith("Login with mock failed:", "down");
        expect(jar.size).toBe(0);
    });
});
