import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { appOrigin, cookieStore, jar, setUp } from "@/test/routes";

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
};

async function logout(headers: Record<string, string>) {
    const { POST } = await import("./route");
    const response = await POST(
        new NextRequest(`${appOrigin}/auth/api/logout`, {
            method: "POST",
            headers,
        }),
    );
    expect(response.status).toBe(303);
    return response.headers.get("location");
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
        expect(await logout(headers)).toBe(`${appOrigin}/auth/login`);
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
