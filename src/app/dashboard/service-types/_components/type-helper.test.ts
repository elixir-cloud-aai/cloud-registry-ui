import { describe, expect, it } from "vitest";
import {
    addTypeDescription,
    breakParts,
    defaultType,
    typeFields,
    typeLimitNote,
} from "./type-helper";

describe("defaultType", () => {
    it("starts in the GA4GH group", () => {
        expect(defaultType).toEqual({
            group: "org.ga4gh",
            artifact: "",
            version: "",
        });
    });
});

describe("addTypeDescription", () => {
    it("says whether new types are pending", () => {
        expect(addTypeDescription(false)).toBe(
            "Services can then be registered with this type.",
        );
        expect(addTypeDescription(true)).toContain("pending");
    });

    it("names the limit of unused types", () => {
        expect(addTypeDescription(false, 5)).toContain(
            "You may have added up to 5 service types that no service has",
        );
        expect(addTypeDescription(true, 1)).toContain(
            "up to 1 service type that",
        );
    });
});

describe("typeLimitNote", () => {
    const user = {
        admin: false,
        adminAvailable: false,
        mayAddServiceTypes: true,
    };
    const none = { maxUnusedServiceTypes: 0 };

    it("explains why users without unused types can't add types", () => {
        expect(typeLimitNote(user, none)).toBe(
            "Only admins can add service types in this registry. Please ask an admin to add the type you need.",
        );
        expect(typeLimitNote({ ...user, adminAvailable: true }, none)).toBe(
            "Only admins can add service types in this registry. Switch to admin mode to add one.",
        );
    });

    it("says nothing if the user may add types, or never may", () => {
        expect(typeLimitNote(user, { maxUnusedServiceTypes: 2 })).toBe(
            undefined,
        );
        expect(typeLimitNote({ ...user, admin: true }, none)).toBe(undefined);
        // GET /me says so, e.g. in mode `controlled`
        expect(
            typeLimitNote({ ...user, mayAddServiceTypes: false }, none),
        ).toBe(undefined);
        expect(typeLimitNote(null, none)).toBe(undefined);
    });
});

describe("typeFields", () => {
    it("lists group, artifact and version on their own", () => {
        expect(
            typeFields({
                group: "org.ga4gh",
                artifact: "beacon",
                version: "2.0.0",
            }),
        ).toEqual([
            { label: "Group", value: "org.ga4gh" },
            { label: "Artifact", value: "beacon" },
            { label: "Version", value: "2.0.0" },
        ]);
    });
});

describe("breakParts", () => {
    it("splits after dots, hyphens, underscores and slashes", () => {
        expect(breakParts("org.ga4gh")).toEqual(["org.", "ga4gh"]);
        expect(breakParts("my-long_artifact/name")).toEqual([
            "my-",
            "long_",
            "artifact/",
            "name",
        ]);
        expect(breakParts("2.0.0-rc.1")).toEqual([
            "2.",
            "0.",
            "0-",
            "rc.",
            "1",
        ]);
    });

    it("keeps values without separators whole", () => {
        expect(breakParts("beacon")).toEqual(["beacon"]);
        expect(breakParts("")).toEqual([""]);
    });
});
