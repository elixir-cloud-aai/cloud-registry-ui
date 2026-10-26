import { describe, expect, it, vi } from "vitest";

async function load() {
    vi.resetModules();
    return import("./settings-checks");
}

describe("publicSettingsChecks", () => {
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
