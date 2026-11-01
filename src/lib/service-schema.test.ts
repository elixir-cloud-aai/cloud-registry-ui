import { describe, expect, it } from "vitest";
import { defaultRegistrationRules } from "./registration-rules";
import {
    defaultTypeGroup,
    type ServiceFields,
    serviceFields,
    serviceSchema,
    serviceTypeSchema,
} from "./service-schema";

const valid: ServiceFields = {
    name: "TES",
    url: "https://tes.example.org/ga4gh/tes/v1",
    organization: { name: "Org", url: "https://example.org" },
    type: { group: "org.ga4gh", artifact: "tes", version: "1.1.0" },
    version: "1.0.0",
    description: "",
    contactUrl: "",
    documentationUrl: "",
    environment: "",
};

function messages(
    change: Partial<ServiceFields>,
    rules = defaultRegistrationRules,
) {
    return serviceSchema(rules)
        .safeParse({ ...valid, ...change })
        .error?.issues.map((val) => val.message);
}

describe("serviceSchema", () => {
    it("accepts a complete registration", () => {
        expect(messages({})).toBeUndefined();
        expect(messages({ environment: "prod" })).toBeUndefined();
    });

    it("follows the registry's URL schemes", () => {
        const rules = { environments: [], urlSchemes: ["http", "https"] };
        expect(messages({ url: "http://tes.example.org" }, rules)).toBe(
            undefined,
        );
        expect(messages({ url: "http://tes.example.org" })).toEqual([
            "Service URL must be an https URL, e.g. https://example.org/.",
        ]);
        expect(
            messages(
                { url: "https://tes.example.org" },
                { environments: [], urlSchemes: ["http"] },
            ),
        ).toEqual([
            "Service URL must be an http URL, e.g. http://example.org/.",
        ]);
        expect(messages({ url: "tes.example.org" }, rules)).toEqual([
            "Service URL must be a valid URL, e.g. https://example.org/.",
        ]);
    });

    it("follows the registry's environments", () => {
        expect(messages({ environment: "qa" })).toEqual([
            "Environment must be one of: 'prod', 'test', 'dev', 'staging'.",
        ]);
        const any = { environments: [], urlSchemes: ["https"] };
        expect(messages({ environment: "qa" }, any)).toBeUndefined();
        expect(messages({ environment: "é".repeat(256) }, any)).toBe(undefined);
        expect(messages({ environment: "é".repeat(257) }, any)).toEqual([
            "Environment must be at most 256 characters.",
        ]);
    });
});

describe("serviceTypeSchema", () => {
    it("trims the type", () => {
        expect(
            serviceTypeSchema.parse({
                group: " org.ga4gh ",
                artifact: "tes ",
                version: " 1",
            }),
        ).toEqual({ group: "org.ga4gh", artifact: "tes", version: "1" });
    });
});

describe("serviceFields", () => {
    it("fills in empty fields and the default type group", () => {
        expect(serviceFields()).toEqual({
            ...valid,
            name: "",
            url: "",
            version: "",
            organization: { name: "", url: "" },
            type: { group: defaultTypeGroup, artifact: "", version: "" },
        });
    });

    it("keeps a registration's fields, without others", () => {
        const service = {
            ...valid,
            id: "tes-1",
            description: undefined,
            environment: "prod",
        };
        expect(serviceFields(service)).toEqual({
            ...valid,
            environment: "prod",
        });
        expect(
            serviceSchema(defaultRegistrationRules).safeParse(
                serviceFields(service),
            ).success,
        ).toBe(true);
    });
});
