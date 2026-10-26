import { describe, expect, it, vi } from "vitest";
import type { FormData } from "./form-helper";

// the schemes and environments are read when the modules load
async function load(env: Record<string, string | undefined> = {}) {
    vi.resetModules();
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    return import("./form-helper");
}

const valid: FormData = {
    name: "TES",
    url: "https://tes.example.org/ga4gh/tes/v1",
    organization: { name: "Org", url: "https://example.org" },
    type: { group: "org.ga4gh", artifact: "tes", version: "1.1.0" },
    version: "1.0.0",
    description: "",
    contactUrl: "",
    documentationUrl: "",
    environment: "",
    createdAt: "",
};

async function messages(change: object, env = {}) {
    const { formDataSchema } = await load(env);
    return formDataSchema
        .safeParse({ ...valid, ...change })
        .error?.issues.map((val) => val.message);
}

describe("formDataSchema", () => {
    it("accepts a complete service", async () => {
        expect(await messages({})).toBeUndefined();
        expect(
            await messages({
                contactUrl: "mailto:support@example.org",
                documentationUrl: "https://docs.example.org",
                environment: "prod",
                createdAt: "2024-02-29T23:59:60.5+01:00",
            }),
        ).toBeUndefined();
    });

    it.each([
        [{ name: "" }, "Service name is required."],
        [
            { url: "tes.example.org" },
            "Service URL must be a valid URL, e.g. https://example.org/.",
        ],
        [
            { url: "https://user@tes.example.org" },
            "Service URL must be a valid URL, e.g. https://example.org/.",
        ],
        [
            { url: "http://tes.example.org" },
            "Service URL must be an https URL, e.g. https://example.org/.",
        ],
        [
            { organization: { name: "Org", url: "ftp://example.org" } },
            "Organization URL must be an http(s) URL, e.g. https://example.org/.",
        ],
        [
            { type: { group: " ", artifact: "tes", version: "1" } },
            "Type group is required.",
        ],
        [
            { contactUrl: "support@example.org" },
            "Contact URL needs mailto: for email addresses, e.g. mailto:support@example.org.",
        ],
        [
            { contactUrl: "javascript:alert(1)" },
            "Contact URL must be an http(s) or mailto: URL, e.g. mailto:support@example.org.",
        ],
        [
            { documentationUrl: "docs" },
            "Documentation URL must be an http(s) URL, e.g. https://docs.example.org/.",
        ],
        [
            { environment: "qa" },
            "Environment must be one of: 'prod', 'test', 'dev', 'staging'.",
        ],
        [
            { createdAt: "2023-02-29T00:00:00Z" },
            "Created At must be an RFC 3339 date-time, e.g. 2024-01-01T00:00:00Z.",
        ],
        [
            { createdAt: "2024-01-01T00:00:00+24:00" },
            "Created At must be an RFC 3339 date-time, e.g. 2024-01-01T00:00:00Z.",
        ],
        [
            { createdAt: "2024-01-01 00:00:00Z" },
            "Created At must be an RFC 3339 date-time, e.g. 2024-01-01T00:00:00Z.",
        ],
    ])("rejects %j", async (change, message) => {
        expect(await messages(change)).toEqual([message]);
    });

    it("follows the configured schemes and environments", async () => {
        const env = {
            NEXT_PUBLIC_SERVICE_URL_SCHEMES: "http,https",
            NEXT_PUBLIC_SERVICE_ENVIRONMENTS: "*",
        };
        expect(
            await messages(
                { url: "http://tes.example.org", environment: "anything" },
                env,
            ),
        ).toBeUndefined();
        expect(await messages({ environment: "é".repeat(257) }, env)).toEqual([
            "Environment must be at most 256 characters.",
        ]);
    });
});

describe("normalizeFormData", () => {
    it("fills in defaults", async () => {
        const { normalizeFormData } = await load();
        expect(normalizeFormData()).toEqual({
            ...valid,
            name: "",
            url: "",
            version: "",
            organization: { name: "", url: "" },
            type: { group: "org.ga4gh", artifact: "", version: "" },
        });
    });

    it("keeps the creation time for admins only", async () => {
        const { normalizeFormData } = await load();
        const data = { ...valid, createdAt: "2024-01-01T00:00:00Z" };
        expect(normalizeFormData(data).createdAt).toBe("");
        expect(normalizeFormData(data, true)).toEqual(data);
        expect(normalizeFormData({ name: "x" }, true).createdAt).toBe("");
    });
});

describe("normalizeServiceData", () => {
    it("trims and drops empty optional fields", async () => {
        const { normalizeServiceData } = await load();
        const service = normalizeServiceData({
            ...valid,
            url: ` ${valid.url} `,
            type: { group: " org.ga4gh ", artifact: "tes ", version: " 1.1.0" },
        });
        expect(service).toEqual({
            name: "TES",
            url: valid.url,
            organization: valid.organization,
            type: valid.type,
            version: "1.0.0",
            description: undefined,
            contactUrl: undefined,
            documentationUrl: undefined,
            environment: undefined,
        });
    });

    it("sends the creation time only if an admin changed it", async () => {
        const { normalizeServiceData } = await load();
        const initial = { ...valid, createdAt: "2024-01-01T00:00:00Z" };
        expect(normalizeServiceData(initial, initial)).not.toHaveProperty(
            "createdAt",
        );
        expect(
            normalizeServiceData(
                { ...initial, createdAt: "2023-01-01T00:00:00Z" },
                initial,
            ).createdAt,
        ).toBe("2023-01-01T00:00:00Z");
        expect(normalizeServiceData(initial)).not.toHaveProperty("createdAt");
    });
});
