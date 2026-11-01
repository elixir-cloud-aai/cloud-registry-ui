import { describe, expect, it } from "vitest";
import {
    compareTypes,
    mayAddServiceTypes,
    noUnusedTypes,
    typeFromKey,
    typeKey,
    typeLabel,
    unusedTypesLimit,
} from "./service-types";

const tes = { group: "org.ga4gh", artifact: "tes", version: "1.1.0" };

describe("service types", () => {
    it("labels and keys types", () => {
        expect(typeLabel(tes)).toBe("org.ga4gh · tes · 1.1.0");
        expect(typeFromKey(typeKey(tes))).toEqual(tes);
        // keys can't collide through separators in the values
        expect(typeKey({ ...tes, group: "a,b" })).not.toBe(
            typeKey({ ...tes, group: "a", artifact: "b,tes" }),
        );
    });

    it("sorts by group, artifact, then version", () => {
        const sorted = [
            { ...tes, version: "2.0.0" },
            { ...tes, artifact: "drs" },
            { ...tes, group: "io.example" },
            tes,
        ].sort(compareTypes);
        expect(sorted.map(typeLabel)).toEqual([
            "io.example · tes · 1.1.0",
            "org.ga4gh · drs · 1.1.0",
            "org.ga4gh · tes · 1.1.0",
            "org.ga4gh · tes · 2.0.0",
        ]);
        expect(compareTypes(tes, { ...tes })).toBe(0);
    });
});

describe("mayAddServiceTypes", () => {
    const user = { admin: false, may_add_service_types: true };

    it("follows GET /me", () => {
        expect(mayAddServiceTypes(user, {})).toBe(true);
        expect(mayAddServiceTypes(user, { maxUnusedServiceTypes: 3 })).toBe(
            true,
        );
        expect(
            mayAddServiceTypes({ ...user, may_add_service_types: false }, {}),
        ).toBe(false);
        // registries before cloud-registry 0.5.0 don't say
        expect(mayAddServiceTypes({ admin: false }, {})).toBe(false);
        expect(mayAddServiceTypes(null, {})).toBe(false);
        expect(mayAddServiceTypes(undefined, {})).toBe(false);
    });

    it("refuses users other than admins without unused types", () => {
        const rules = { maxUnusedServiceTypes: 0 };
        expect(mayAddServiceTypes(user, rules)).toBe(false);
        expect(mayAddServiceTypes({ ...user, admin: true }, rules)).toBe(true);
    });
});

describe("unused types", () => {
    it("tells a limit of 0 apart", () => {
        expect(noUnusedTypes({ maxUnusedServiceTypes: 0 })).toBe(true);
        expect(noUnusedTypes({ maxUnusedServiceTypes: 1 })).toBe(false);
        expect(noUnusedTypes({})).toBe(false);
    });

    it("limits users other than admins", () => {
        const rules = { maxUnusedServiceTypes: 4 };
        expect(unusedTypesLimit({ admin: false }, rules)).toBe(4);
        expect(unusedTypesLimit(null, rules)).toBe(4);
        expect(unusedTypesLimit({ admin: true }, rules)).toBeUndefined();
        expect(unusedTypesLimit({ admin: false }, {})).toBeUndefined();
    });
});
