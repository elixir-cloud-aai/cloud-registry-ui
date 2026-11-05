import axios from "axios";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
    appOrigin,
    cookieStore,
    discovery,
    jar,
    provider,
    setUp,
} from "@/test/routes";

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const session = {
    access_token: "a",
    id_token: "i",
    login_provider: "mock",
    admin_mode: "1",
    authState: "s",
    authProvider: "mock",
    authVerifier: "v",
    authNonce: "n",
    authReturnTo: "/invitations",
};

// the provider's end session endpoint, keeping its query parameters
const providerLogout = `${provider.issuer}/logout?${new URLSearchParams({
    ui: "1",
    id_token_hint: "i",
    client_id: "client",
    post_logout_redirect_uri: `${appOrigin}/auth/login`,
})}`;

/**
 * Log out
 * @param headers Headers of the request
 * @returns Where the browser goes next: the redirect's location, or the
 * URL that the page refreshes to
 */
async function logout(headers: Record<string, string>) {
    const { POST } = await import("./route");
    const response = await POST(
        new NextRequest(`${appOrigin}/auth/api/logout`, {
            method: "POST",
            headers,
        }),
    );
    if (response.status === 303) return response.headers.get("location");
    expect(response.status).toBe(200);
    const page = await response.text();
    const url = /<meta http-equiv="refresh" content="0;url=([^"]*)">/.exec(
        page,
    )?.[1];
    return url?.replaceAll("&amp;", "&");
}

describe("POST /auth/api/logout", () => {
    it.each([
        ["from the app", { origin: appOrigin }],
        ["without Origin, same-origin", { "sec-fetch-site": "same-origin" }],
        [
            "with Origin null, same-origin",
            { origin: "null", "sec-fetch-site": "same-origin" },
        ],
    ])("logs out %s", async (_, headers) => {
        setUp(session);
        expect(await logout(headers)).toBe(providerLogout);
        expect(jar.size).toBe(0);
    });

    it("logs out sessions of the __Host- and the old names in production", async () => {
        vi.stubEnv("NODE_ENV", "production");
        setUp({
            ...Object.fromEntries(
                Object.entries(session)
                    .filter(([name]) => name !== "admin_mode")
                    .map(([name, value]) => [`__Host-${name}`, value]),
            ),
            ...session,
        });
        expect(await logout({ origin: appOrigin })).toBe(providerLogout);
        expect(jar.size).toBe(0);
    });

    it("ends sessions of earlier versions at the only provider", async () => {
        setUp({ ...session, login_provider: undefined });
        expect(await logout({ origin: appOrigin })).toBe(providerLogout);
    });

    it.each([
        ["without a session", {}],
        ["without an ID token", { ...session, id_token: undefined }],
        ["of an unknown provider", { ...session, login_provider: "other" }],
    ])("logs out at the app only %s", async (_, cookies) => {
        setUp(cookies);
        const get = vi.spyOn(axios, "get");
        expect(await logout({ origin: appOrigin })).toBe(
            `${appOrigin}/auth/login`,
        );
        expect(get).not.toHaveBeenCalled();
        expect(jar.size).toBe(0);
    });

    it.each([
        ["no end session endpoint", undefined],
        ["an empty end session endpoint", ""],
    ])(
        "logs out at the app only for providers with %s",
        async (_, endpoint) => {
            setUp(session);
            vi.spyOn(axios, "get").mockResolvedValue({
                data: { ...discovery, end_session_endpoint: endpoint },
            });
            expect(await logout({ origin: appOrigin })).toBe(
                `${appOrigin}/auth/login`,
            );
            expect(jar.size).toBe(0);
        },
    );

    it("goes on to the provider with a page, not a redirect, also on another host than the issuer", async () => {
        setUp(session);
        // e.g. on another host than the issuer
        vi.spyOn(axios, "get").mockResolvedValue({
            data: {
                ...discovery,
                end_session_endpoint:
                    'https://sso.example.org/logout?a="<b>"&c=d',
            },
        });
        const { POST } = await import("./route");
        const response = await POST(
            new NextRequest(`${appOrigin}/auth/api/logout`, {
                method: "POST",
                headers: { origin: appOrigin },
            }),
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(
            "text/html; charset=utf-8",
        );
        // the URL holds the ID token
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        const page = await response.text();
        const href =
            "https://sso.example.org/logout?a=%22%3Cb%3E%22&amp;c=d&amp;id_token_hint=i&amp;client_id=client&amp;post_logout_redirect_uri=https%3A%2F%2Fapp.example.org%2Fauth%2Flogin";
        expect(page).toContain(
            `<meta http-equiv="refresh" content="0;url=${href}">`,
        );
        expect(page).toContain(`<a href="${href}">`);
        expect(jar.size).toBe(0);
    });

    it("logs out at the app only, logging why, if the discovery fails", async () => {
        setUp(session);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(axios, "get").mockRejectedValue(new Error("down"));
        expect(await logout({ origin: appOrigin })).toBe(
            `${appOrigin}/auth/login`,
        );
        expect(log).toHaveBeenCalledWith(
            "Logout at mock skipped (logged out of the app only):",
            "down",
        );
        expect(jar.size).toBe(0);
    });

    it.each([
        ["from another site", { origin: "https://evil.example.org" }],
        ["without Origin", {}],
        [
            "with Origin null, cross-site",
            { origin: "null", "sec-fetch-site": "cross-site" },
        ],
        // the browser's own header wins over a missing one
        [
            "from another site, same-origin",
            {
                origin: "https://evil.example.org",
                "sec-fetch-site": "same-origin",
            },
        ],
    ])("refuses requests %s", async (_, headers) => {
        setUp(session);
        expect(await logout(headers)).toBe(
            `${appOrigin}/auth/error?type=logout-origin`,
        );
        expect(jar.size).toBe(Object.keys(session).length);
    });

    it("reports failures", async () => {
        setUp(session);
        vi.spyOn(cookieStore, "set").mockImplementation(() => {
            throw new Error("read-only");
        });
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(await logout({ origin: appOrigin })).toBe(
            `${appOrigin}/auth/error?type=logout-err`,
        );
        expect(log).toHaveBeenCalledWith("Logout failed:", "read-only");
    });
});
