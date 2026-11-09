import { describe, expect, it, vi } from "vitest";
import {
    cookieName,
    cookieNames,
    secureCookies,
    sessionCookie,
} from "./session-cookies";

describe("cookie names", () => {
    it("have the prefix __Host- in production, and the old names too", () => {
        vi.stubEnv("NODE_ENV", "production");
        expect(secureCookies()).toBe(true);
        expect(cookieName("access_token")).toBe("__Host-access_token");
        expect(cookieNames("access_token")).toEqual([
            "__Host-access_token",
            "access_token",
        ]);
    });

    it.each(["development", "test"])("are plain in %s", (env) => {
        vi.stubEnv("NODE_ENV", env);
        expect(secureCookies()).toBe(false);
        expect(cookieName("access_token")).toBe("access_token");
        expect(cookieNames("access_token")).toEqual(["access_token"]);
    });
});

describe("sessionCookie", () => {
    const read = (cookies: Record<string, string>) =>
        sessionCookie("access_token", (name) => cookies[name]);

    it("reads only the __Host- name in production", () => {
        vi.stubEnv("NODE_ENV", "production");
        expect(
            read({ "__Host-access_token": "new", access_token: "old" }),
        ).toBe("new");
        expect(read({ access_token: "old" })).toBeUndefined();
        expect(
            read({ "__Host-access_token": "", access_token: "old" }),
        ).toBeUndefined();
        expect(read({})).toBeUndefined();
    });

    it("reads only the plain name in development", () => {
        vi.stubEnv("NODE_ENV", "development");
        expect(read({ access_token: "a" })).toBe("a");
        expect(read({ "__Host-access_token": "a" })).toBeUndefined();
    });
});
