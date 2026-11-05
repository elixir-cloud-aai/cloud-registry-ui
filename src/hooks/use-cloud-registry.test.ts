import { beforeEach, describe, expect, it, vi } from "vitest";
import { react } from "@/test/react";

const cookies = vi.hoisted(() => new Map<string, string>());

// React's hooks, as the tests run in Node without a DOM
vi.mock("react", async () => (await import("@/test/react")).reactMock);
vi.mock("cookies-next/client", () => ({
    getCookie: (name: string) => cookies.get(name),
}));
// takes options or a URL and a token, as the real provider does
vi.mock("@/lib/authenticated-cloud-registry", () => ({
    AuthenticatedCloudRegistryProvider: class {
        readonly baseUrl: string;
        readonly token?: string;
        readonly roles: string[];
        constructor(
            options:
                | { baseUrl: string; token?: string; roles?: string[] }
                | string,
            token?: string,
        ) {
            const o =
                typeof options === "string"
                    ? { baseUrl: options, token }
                    : options;
            this.baseUrl = o.baseUrl;
            this.token = o.token;
            this.roles = o.roles ?? [];
        }
    },
}));

const { useCloudRegistry } = await import("./use-cloud-registry");

type Provider = { baseUrl: string; token?: string; roles: string[] };
const provider = (hook: ReturnType<typeof useCloudRegistry>) =>
    hook.cloudRegistryProvider as unknown as Provider;

beforeEach(() => {
    react.reset();
    cookies.clear();
    vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", "https://registry.test");
});

describe("useCloudRegistry", () => {
    it("builds an anonymous provider without a token", () => {
        const hook = react.render(useCloudRegistry);
        expect(hook.isLoggedIn).toBe(false);
        expect(provider(hook)).toEqual({
            baseUrl: "https://registry.test",
            token: undefined,
            roles: [],
        });
    });

    it("falls back to an empty registry URL", () => {
        vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", "");
        cookies.set("access_token", "a");
        expect(provider(react.render(useCloudRegistry)).baseUrl).toBe("");
        cookies.clear();
        react.reset();
        expect(provider(react.render(useCloudRegistry)).baseUrl).toBe("");
    });

    it("uses the new token after login", () => {
        react.render(useCloudRegistry);
        cookies.set("access_token", "a");
        const hook = react.render(useCloudRegistry);
        expect(hook.isLoggedIn).toBe(true);
        expect(provider(hook).token).toBe("a");
    });

    it("uses the new token after it changes", () => {
        cookies.set("access_token", "a");
        react.render(useCloudRegistry);
        cookies.set("access_token", "b");
        expect(provider(react.render(useCloudRegistry)).token).toBe("b");
    });

    it("keeps the admin role with the new token", () => {
        cookies.set("admin_mode", "1");
        cookies.set("access_token", "a");
        react.render(useCloudRegistry);
        cookies.set("access_token", "b");
        const hook = provider(react.render(useCloudRegistry));
        expect(hook.token).toBe("b");
        expect(hook.roles).toEqual(["admin"]);
    });

    it("asks for no roles in user mode", () => {
        cookies.set("access_token", "a");
        expect(provider(react.render(useCloudRegistry)).roles).toEqual([]);
    });

    it("drops the token after logout", () => {
        cookies.set("access_token", "a");
        react.render(useCloudRegistry);
        cookies.clear();
        const hook = react.render(useCloudRegistry);
        expect(hook.isLoggedIn).toBe(false);
        expect(provider(hook).token).toBeUndefined();
    });
});
