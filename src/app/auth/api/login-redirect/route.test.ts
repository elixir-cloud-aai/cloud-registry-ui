import axios from "axios";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
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
    it("sends the user to the provider with a new state", async () => {
        setUp();
        const response = await login("?provider=mock");
        const location = new URL(response.headers.get("location") ?? "");
        expect(`${location.origin}${location.pathname}`).toBe(
            `${provider.issuer}/authorize`,
        );
        const state = jar.get("authState");
        expect(Object.fromEntries(location.searchParams)).toEqual({
            prompt: "login",
            response_type: "code",
            client_id: "client",
            redirect_uri: "https://app.example.org/auth/api/callback",
            scope: "openid profile email",
            state: state?.value,
        });
        expect(state).toMatchObject({
            httpOnly: true,
            sameSite: "lax",
            path: "/",
        });
        expect(jar.get("authProvider")?.value).toBe("mock");
    });

    it("uses the only provider without an ID", async () => {
        setUp();
        expect((await login()).status).toBe(307);
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
