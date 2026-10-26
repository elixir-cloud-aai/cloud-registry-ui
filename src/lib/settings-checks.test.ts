import { beforeEach, describe, expect, it, vi } from "vitest";

// settings of the test process must not leak into the tests
function clearPublicSettings() {
    for (const name of Object.keys(process.env))
        if (name.startsWith("NEXT_PUBLIC_")) vi.stubEnv(name, undefined);
}

async function load() {
    vi.resetModules();
    return import("./settings-checks");
}

describe("publicSettingsChecks", () => {
    beforeEach(clearPublicSettings);

    it("accepts valid settings", async () => {
        vi.stubEnv(
            "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
            "https://registry.example.org/ga4gh/registry/v1",
        );
        const { publicSettingsChecks } = await load();
        expect(publicSettingsChecks).not.toThrow();
    });

    it.each([
        ["NEXT_PUBLIC_SERVICE_URL_SCHEMES", "ftp", /SERVICE_URL_SCHEMES/],
        ["NEXT_PUBLIC_APP_TITLE", "x".repeat(25), /APP_TITLE/],
        ["NEXT_PUBLIC_SERVICE_ENVIRONMENTS", "*,prod", /ENVIRONMENTS/],
    ])("checks %s", async (name, value, message) => {
        vi.stubEnv(
            "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
            "https://registry.example.org/ga4gh/registry/v1",
        );
        vi.stubEnv(name, value);
        const { publicSettingsChecks } = await load();
        expect(publicSettingsChecks).toThrow(message);
    });

    it("needs the registry URL", async () => {
        vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", undefined);
        const { publicSettingsChecks } = await load();
        expect(publicSettingsChecks).toThrow(/Missing setting/);
    });
});
