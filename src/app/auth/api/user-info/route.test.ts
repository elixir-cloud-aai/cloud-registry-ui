import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import { cookieStore, discovery, jar, provider, setUp } from "@/test/routes";

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

async function userInfo() {
    const { GET } = await import("./route");
    const response = await GET();
    return { status: response.status, body: await response.json() };
}

function answer(data: unknown) {
    return vi.spyOn(axios, "get").mockImplementation(async (url) => {
        if (url !== discovery.userinfo_endpoint) return { data: discovery };
        if (data instanceof Error) throw data;
        return { data };
    });
}

describe("GET /auth/api/user-info", () => {
    it("gets the user's claims with the access token", async () => {
        setUp({ access_token: "a", login_provider: "mock" });
        const get = answer({ sub: "alice", name: "Alice" });
        expect(await userInfo()).toEqual({
            status: 200,
            body: { error: false, user: { sub: "alice", name: "Alice" } },
        });
        expect(get).toHaveBeenCalledWith(discovery.userinfo_endpoint, {
            headers: { Authorization: "Bearer a", Accept: "application/json" },
            timeout: 10000,
            maxRedirects: 0,
        });
    });

    it("uses the only provider for sessions without one", async () => {
        setUp({ access_token: "a" });
        answer({ sub: "alice" });
        expect((await userInfo()).status).toBe(200);
    });

    it("is 401 without a session, asking no one", async () => {
        setUp();
        const get = vi.spyOn(axios, "get");
        expect(await userInfo()).toEqual({
            status: 401,
            body: { error: true, user: null },
        });
        expect(get).not.toHaveBeenCalled();
    });

    it("is 401 for expired tokens, without logging", async () => {
        setUp({ access_token: "a" });
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        answer(
            new AxiosError("x", "E", {} as InternalAxiosRequestConfig, {}, {
                status: 401,
            } as never),
        );
        expect((await userInfo()).status).toBe(401);
        expect(log).not.toHaveBeenCalled();
    });

    it("reads the session by its __Host- names in production", async () => {
        vi.stubEnv("NODE_ENV", "production");
        setUp({ "__Host-access_token": "a", "__Host-login_provider": "mock" });
        const get = answer({ sub: "alice" });
        expect((await userInfo()).status).toBe(200);
        expect(get).toHaveBeenCalledWith(
            discovery.userinfo_endpoint,
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer a" }),
            }),
        );
    });

    it("reads sessions of earlier versions in production", async () => {
        vi.stubEnv("NODE_ENV", "production");
        setUp({ access_token: "old", login_provider: "mock" });
        const get = answer({ sub: "alice" });
        expect((await userInfo()).status).toBe(200);
        expect(get).toHaveBeenCalledWith(
            discovery.userinfo_endpoint,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer old",
                }),
            }),
        );
    });

    it.each([
        ["of an unknown provider", { login_provider: "other" }, false],
        // e.g. of an earlier version, after a second provider was added
        ["without a provider, of several", {}, true],
    ])(
        "takes sessions %s as logged out, without logging",
        async (_, cookies, several) => {
            setUp({ access_token: "a", id_token: "i", ...cookies });
            if (several)
                vi.stubEnv(
                    "LOGIN_PROVIDERS",
                    JSON.stringify([provider, { ...provider, id: "other" }]),
                );
            const log = vi.spyOn(console, "error").mockImplementation(() => {});
            const get = answer({ sub: "alice" });
            expect(await userInfo()).toEqual({
                status: 401,
                body: { error: true, user: null },
            });
            expect(log).not.toHaveBeenCalled();
            expect(get).not.toHaveBeenCalled();
            // a late answer mustn't delete the cookies of a new login
            expect(jar.size).toBe(Object.keys(cookies).length + 2);
        },
    );

    it.each([
        ["a failed request", {}, new Error("down"), "down"],
        [
            "a response that isn't an object",
            {},
            "text",
            "Invalid JSON response",
        ],
    ])("is 401 and logs %s", async (_, cookies, data, message) => {
        setUp({ access_token: "a", ...cookies });
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        answer(data);
        expect((await userInfo()).status).toBe(401);
        expect(log).toHaveBeenCalledWith("User info failed:", message);
    });
});
