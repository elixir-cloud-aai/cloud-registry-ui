import { describe, expect, it } from "vitest";
import { compareTypes, typeFromKey, typeKey, typeLabel } from "./service-types";

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
