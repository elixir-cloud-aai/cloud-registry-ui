import { describe, expect, it, vi } from "vitest";

async function load(environments?: string) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SERVICE_ENVIRONMENTS", environments);
    return import("./service-environments");
}

describe("service environments", () => {
    it("defaults to the GA4GH values, also if empty", async () => {
        for (const value of [undefined, "", " , "]) {
            const envs = await load(value);
            expect(envs.serviceEnvironments).toEqual([
                "prod",
                "test",
                "dev",
                "staging",
            ]);
            expect(envs.isAllowedEnvironment("prod")).toBe(true);
            expect(envs.isAllowedEnvironment("qa")).toBe(false);
        }
    });

    it("uses the configured values, in order, once", async () => {
        const envs = await load(" qa, prod ,qa");
        expect(envs.serviceEnvironments).toEqual(["qa", "prod"]);
        expect(envs.environmentMessage).toBe(
            "Environment must be one of: 'qa', 'prod'.",
        );
        expect(envs.environmentRank("prod")).toBe(1);
        expect(envs.environmentRank("other")).toBe(2);
        expect(envs.isAllowedEnvironment("")).toBe(true);
        expect(envs.isAllowedEnvironment(undefined)).toBe(true);
    });

    it("allows any value for *", async () => {
        const envs = await load("*");
        expect(envs.serviceEnvironments).toEqual([]);
        expect(envs.isAllowedEnvironment("anything")).toBe(true);
        expect(() => envs.environmentSettings()).not.toThrow();
    });

    it("rejects * with other values", async () => {
        const { environmentSettings } = await load("*,prod");
        expect(environmentSettings).toThrow(/can't be combined/);
    });

    it("rejects values longer than the registry allows", async () => {
        const ok = await load("é".repeat(256));
        expect(ok.environmentSettings).not.toThrow();
        const { environmentSettings } = await load("é".repeat(257));
        expect(environmentSettings).toThrow(/more than 256 characters/);
    });
});
