import { describe, expect, it } from "vitest";
import { failure } from "@/test/errors";
import {
    createFormValues,
    fillCreateForm,
    type ImportValues,
    importError,
    sameValues,
} from "./service-import";

const tes = { group: "org.ga4gh", artifact: "tes", version: "1.1.0" };
const imported: ImportValues = {
    name: "TES",
    url: "https://tes.example.org/ga4gh/tes/v1",
    type: tes,
    organization: { name: "Org", url: "https://example.org" },
    version: "1.0.0",
    description: "Runs tasks",
};

/** A create form as the component starts, with its registered types */
function emptyForm(serviceTypes = [tes]) {
    return {
        typeChoice: "",
        serviceTypes,
        formData: {
            name: "",
            url: "",
            organization: { name: "", url: "" },
            type: { group: "org.ga4gh", artifact: "", version: "" },
            version: "",
            description: "",
            contactUrl: "",
            documentationUrl: "",
            environment: "",
            customServiceId: "kept",
        } as ImportValues & Record<string, unknown>,
    };
}

describe("sameValues", () => {
    it("takes empty and missing optional values as the same", () => {
        expect(
            sameValues(
                { ...imported, contactUrl: "", environment: "" },
                imported,
            ),
        ).toBe(true);
    });

    it.each([
        ["name", { name: "Other" }],
        ["URL", { url: "https://other.example.org" }],
        ["version", { version: "2.0.0" }],
        ["description", { description: "" }],
        ["contact", { contactUrl: "mailto:a@example.org" }],
        ["documentation", { documentationUrl: "https://example.org/docs" }],
        ["environment", { environment: "test" }],
        ["type", { type: { ...tes, version: "1.0.0" } }],
        [
            "organization",
            { organization: { name: "Other", url: "https://example.org" } },
        ],
    ])("tells a changed %s", (_, change) => {
        expect(sameValues({ ...imported, ...change }, imported)).toBe(false);
    });

    it("compares all optional values", () => {
        const full = {
            ...imported,
            contactUrl: "mailto:a@example.org",
            documentationUrl: "https://example.org/docs",
            environment: "test",
        };
        expect(sameValues(full, full)).toBe(true);
        expect(sameValues(full, { ...full, description: undefined })).toBe(
            false,
        );
    });

    it("ignores values that sync doesn't write", () => {
        const form = { ...imported, customServiceId: "my-id" };
        expect(sameValues(form, imported)).toBe(true);
    });
});

describe("fillCreateForm", () => {
    it("chooses a registered type, and keeps other values", () => {
        const form = emptyForm();
        expect(fillCreateForm(form, imported, false)).toEqual({
            filled: true,
            typeOffered: true,
        });
        expect(form.typeChoice).toBe(JSON.stringify(Object.values(tes)));
        expect(form.formData).toMatchObject({
            ...imported,
            contactUrl: "",
            customServiceId: "kept",
        });
        expect(
            sameValues(createFormValues(form) as ImportValues, imported),
        ).toBe(true);
    });

    it("takes a new type if the form offers them", () => {
        const form = emptyForm([]);
        expect(fillCreateForm(form, imported, true).typeOffered).toBe(true);
        expect(form.typeChoice).toBe("new");
        expect(form.formData.type).toEqual(tes);
    });

    it("leaves the choice of the type to users otherwise", () => {
        const form = emptyForm([]);
        expect(fillCreateForm(form, imported, false)).toEqual({
            filled: true,
            typeOffered: false,
        });
        expect(form.typeChoice).toBe("");
        expect(form.formData.type).toEqual({
            group: "org.ga4gh",
            artifact: "",
            version: "",
        });
        expect(form.formData.name).toBe("TES");
    });

    it("takes all optional values", () => {
        const form = emptyForm();
        const full = {
            ...imported,
            contactUrl: "mailto:a@example.org",
            documentationUrl: "https://example.org/docs",
            environment: "test",
        };
        fillCreateForm(form, full, false);
        expect(form.formData).toMatchObject(full);
        fillCreateForm(form, { ...full, description: undefined }, false);
        expect(form.formData.description).toBe("");
    });

    it("replaces the values of an earlier import", () => {
        const form = emptyForm();
        fillCreateForm(
            form,
            { ...imported, contactUrl: "mailto:a@example.org" },
            false,
        );
        fillCreateForm(form, imported, false);
        expect(form.formData.contactUrl).toBe("");
    });

    it.each([
        ["no form", null],
        ["another state", { formData: { name: "" } }],
        [
            "no type choice",
            { formData: emptyForm().formData, serviceTypes: [] },
        ],
        [
            "no registered types",
            { formData: emptyForm().formData, typeChoice: "" },
        ],
        [
            "no type",
            {
                formData: { organization: {} },
                typeChoice: "",
                serviceTypes: [],
            },
        ],
    ])("reports a form that can't be filled in: %s", (_, form) => {
        expect(fillCreateForm(form, imported, true).filled).toBe(false);
        expect(createFormValues(form)).toBeUndefined();
    });
});

describe("importError", () => {
    it("tells nothing about why a fetch failed", () => {
        const message = importError(failure(502, { detail: "raw" }));
        expect(message).toContain("only publicly available");
        expect(message).not.toContain("raw");
    });

    it("asks to wait above the limit", () => {
        expect(importError(failure(429))).toContain("too often");
    });

    it("names the field of an invalid address or service info", () => {
        expect(
            importError(failure(400, { detail: "'url' must be a URL" })),
        ).toBe("'Service URL' must be a URL");
        expect(importError(failure(400))).toContain("can't be imported");
    });

    it("falls back to the messages of failed changes", () => {
        expect(importError(failure(401))).toContain("log in");
        expect(importError(failure(403))).toContain("import service info");
        expect(importError(new Error("x"))).toBe(
            "Cannot import service info currently.",
        );
    });
});
