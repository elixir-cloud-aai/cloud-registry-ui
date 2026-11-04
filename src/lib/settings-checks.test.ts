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

    it("checks the branding", async () => {
        vi.stubEnv(
            "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
            "https://registry.example.org/ga4gh/registry/v1",
        );
        vi.stubEnv("NEXT_PUBLIC_APP_TITLE", "x".repeat(25));
        const { publicSettingsChecks } = await load();
        expect(publicSettingsChecks).toThrow(/APP_TITLE/);
    });

    it("checks the page size of the access dialog", async () => {
        vi.stubEnv(
            "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
            "https://registry.example.org/ga4gh/registry/v1",
        );
        vi.stubEnv("NEXT_PUBLIC_ACCESS_PAGE_SIZE", "many");
        const { publicSettingsChecks } = await load();
        expect(publicSettingsChecks).toThrow(/ACCESS_PAGE_SIZE/);
    });

    it("checks the label setting of the access dialog", async () => {
        vi.stubEnv(
            "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
            "https://registry.example.org/ga4gh/registry/v1",
        );
        vi.stubEnv("NEXT_PUBLIC_INVITATION_LABEL_REQUIRED", "maybe");
        const { publicSettingsChecks } = await load();
        expect(publicSettingsChecks).toThrow(/INVITATION_LABEL_REQUIRED/);
    });

    it.each([
        ["NEXT_PUBLIC_SERVICE_ENVIRONMENTS", "*,prod", "environments"],
        ["NEXT_PUBLIC_SERVICE_URL_SCHEMES", "", "URL schemes"],
    ])("ignores the removed %s with a warning", async (name, value, rule) => {
        vi.stubEnv(
            "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
            "https://registry.example.org/ga4gh/registry/v1",
        );
        vi.stubEnv(name, value);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { publicSettingsChecks } = await load();
        expect(publicSettingsChecks).not.toThrow();
        expect(warn).toHaveBeenCalledExactlyOnceWith(
            `Ignoring setting ${name}: the app reads the allowed ${rule} of services from the registry's service info (registrationRules). Remove the setting.`,
        );
    });

    it("warns of no removed settings that aren't set", async () => {
        vi.stubEnv(
            "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
            "https://registry.example.org/ga4gh/registry/v1",
        );
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { publicSettingsChecks } = await load();
        publicSettingsChecks();
        expect(warn).not.toHaveBeenCalled();
    });

    it("needs the registry URL", async () => {
        vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", undefined);
        const { publicSettingsChecks } = await load();
        expect(publicSettingsChecks).toThrow(/Missing setting/);
    });
});
