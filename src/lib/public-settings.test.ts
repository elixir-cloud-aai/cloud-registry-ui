import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// settings of the test process must not leak into the tests
function clearPublicSettings() {
    for (const name of Object.keys(process.env))
        if (name.startsWith("NEXT_PUBLIC_")) vi.stubEnv(name, undefined);
}

const url = "https://registry.example.org/ga4gh/registry/v1";

async function load() {
    vi.resetModules();
    return import("./public-settings");
}

beforeEach(clearPublicSettings);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("publicSetting on the server", () => {
    it("reads the environment when called", async () => {
        const { publicSetting } = await load();
        vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", url);
        expect(publicSetting("NEXT_PUBLIC_CLOUD_REGISTRY_URL")).toBe(url);
    });

    it("falls back to the value set when building", async () => {
        // the module's literal reads stand for the values set when building
        vi.stubEnv("NEXT_PUBLIC_APP_TITLE", "Built");
        const { publicSetting } = await load();
        vi.stubEnv("NEXT_PUBLIC_APP_TITLE", undefined);
        expect(publicSetting("NEXT_PUBLIC_APP_TITLE")).toBe("Built");
    });

    it("prefers the environment, also an empty value", async () => {
        vi.stubEnv("NEXT_PUBLIC_APP_TITLE", "Built");
        const { publicSetting } = await load();
        vi.stubEnv("NEXT_PUBLIC_APP_TITLE", "Runtime");
        expect(publicSetting("NEXT_PUBLIC_APP_TITLE")).toBe("Runtime");
        vi.stubEnv("NEXT_PUBLIC_APP_TITLE", "");
        expect(publicSetting("NEXT_PUBLIC_APP_TITLE")).toBe("");
    });
});

describe("publicSettingsScript", () => {
    it("passes only the public settings that are set", async () => {
        vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", url);
        vi.stubEnv("NEXT_PUBLIC_APP_TITLE", undefined);
        vi.stubEnv("LOGIN_PROVIDERS", "secret");
        const { publicSettingsScript } = await load();
        const script = publicSettingsScript();
        expect(script).toMatch(/^window\.__PUBLIC_SETTINGS__=\{.*\};$/);
        const settings = JSON.parse(script.slice(script.indexOf("=") + 1, -1));
        expect(settings).toEqual({ NEXT_PUBLIC_CLOUD_REGISTRY_URL: url });
    });

    it("escapes < so that no value can end the script", async () => {
        vi.stubEnv("NEXT_PUBLIC_APP_TITLE", "</script><b>x");
        const { publicSettingsScript } = await load();
        const script = publicSettingsScript();
        expect(script).not.toContain("<");
        expect(script).toContain("\\u003c/script>");
    });
});

describe("publicSetting in the browser", () => {
    it("reads the settings that the page passed", async () => {
        vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", "https://built.example");
        const { publicSetting } = await load();
        vi.stubGlobal("window", {
            __PUBLIC_SETTINGS__: { NEXT_PUBLIC_CLOUD_REGISTRY_URL: url },
        });
        expect(publicSetting("NEXT_PUBLIC_CLOUD_REGISTRY_URL")).toBe(url);
        // not passed: the value set when building
        expect(publicSetting("NEXT_PUBLIC_APP_TITLE")).toBeUndefined();
    });

    it("warns once without settings and uses those set when building", async () => {
        vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", "https://built.example");
        const { publicSetting } = await load();
        vi.stubGlobal("window", {});
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(publicSetting("NEXT_PUBLIC_CLOUD_REGISTRY_URL")).toBe(
            "https://built.example",
        );
        publicSetting("NEXT_PUBLIC_APP_TITLE");
        expect(error).toHaveBeenCalledTimes(1);
        expect(error.mock.calls[0][0]).toMatch(/no settings/);
    });
});
