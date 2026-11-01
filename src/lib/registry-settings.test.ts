import { describe, expect, it, vi } from "vitest";

const url = "https://registry.example.org/ga4gh/registry/v1";

async function load(registryUrl: string | undefined) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", registryUrl);
    return import("./registry-settings");
}

describe("registrySettings", () => {
    it.each([
        url,
        "HTTPS://registry.example.org/x",
        "https://[2001:db8::1]/x",
        "http://localhost:8080/ga4gh/registry/v1",
        "http://registry.localhost/x",
        "http://127.0.0.1:8080/x",
        "http://[::1]:8080/x",
    ])("accepts %s", async (value) => {
        const { registrySettings } = await load(value);
        expect(registrySettings).not.toThrow();
    });

    it.each([
        [undefined, /Missing setting/],
        ["", /Missing setting/],
        [` ${url}`, /spaces/],
        ["/ga4gh/registry/v1", /not an absolute URL/],
        ["https:registry.example.org/x", /"\/\/" after the scheme/],
        ["http://registry.example.org/x", /must be an https URL/],
        ["http://localhost.example.org/x", /must be an https URL/],
        ["ftp://registry.example.org/x", /must be an https URL/],
        [`${url}?a=1`, /query or fragment/],
        [`${url}?`, /query or fragment/],
        [`${url}#`, /query or fragment/],
        ["https://user@registry.example.org/x", /user, password/],
    ])("rejects %s", async (value, message) => {
        const { registrySettings } = await load(value);
        expect(registrySettings).toThrow(message);
    });

    it("hides credentials in messages", async () => {
        const { registrySettings } = await load(
            "http://user:secret@registry.example.org/x ",
        );
        expect(registrySettings).toThrow("http://***@registry.example.org/x ");
        expect(registrySettings).not.toThrow(/secret/);
    });
});
