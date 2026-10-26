import { describe, expect, it } from "vitest";
import { defaultType } from "./type-helper";

describe("defaultType", () => {
    it("starts in the GA4GH group", () => {
        expect(defaultType).toEqual({
            group: "org.ga4gh",
            artifact: "",
            version: "",
        });
    });
});
