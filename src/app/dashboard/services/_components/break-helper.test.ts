import { describe, expect, it } from "vitest";
import { breakSegments } from "./break-helper";

describe("breakSegments", () => {
    it("breaks URLs after slashes, dots and query delimiters", () => {
        expect(
            breakSegments("https://beacon-no.example.org/api?a=1&b=2"),
        ).toEqual([
            "https://",
            "beacon-",
            "no.",
            "example.",
            "org/",
            "api?",
            "a=",
            "1&",
            "b=",
            "2",
        ]);
    });

    it("keeps runs of delimiters together", () => {
        expect(breakSegments("a//b..c__d")).toEqual(["a//", "b..", "c__", "d"]);
    });

    it("breaks dotted and underscored IDs", () => {
        expect(breakSegments("org.ga4gh_beacon")).toEqual([
            "org.",
            "ga4gh_",
            "beacon",
        ]);
    });

    it("keeps values without delimiters whole", () => {
        expect(breakSegments("EU5T3I")).toEqual(["EU5T3I"]);
        expect(breakSegments("Demo Beacon Oslo")).toEqual(["Demo Beacon Oslo"]);
    });

    it("keeps leading delimiters", () => {
        expect(breakSegments("/path/")).toEqual(["/", "path/"]);
    });

    it("joins to the value", () => {
        const value = "http://localhost:8180/ga4gh/registry/v1";
        expect(breakSegments(value).join("")).toBe(value);
    });

    it("returns no segments for an empty value", () => {
        expect(breakSegments("")).toEqual([]);
    });
});
