import { describe, expect, it } from "vitest";
import { maxServiceIdLength, serviceIdError } from "./service-ids";

describe("serviceIdError", () => {
    it.each([
        "tes-1",
        "a b",
        "ünïcode-✓",
        "...",
        ".types",
        "types2",
        "a\\b",
        "#1",
        "😀",
    ])("accepts %j", (id) => {
        expect(serviceIdError(id)).toBeUndefined();
    });

    it.each([
        ["", "Service ID is required."],
        [".", "Service ID must not be ., .. or types."],
        ["..", "Service ID must not be ., .. or types."],
        ["types", "Service ID must not be ., .. or types."],
        ["a/b", "Service ID must not contain slashes."],
        ["a,b", "Service ID must not contain commas or line breaks."],
        ["a\nb", "Service ID must not contain commas or line breaks."],
        ["a\rb", "Service ID must not contain commas or line breaks."],
        ["a\ud800", "Service ID must not contain invalid characters."],
        ["\udc00a", "Service ID must not contain invalid characters."],
    ])("rejects %j", (id, message) => {
        expect(serviceIdError(id)).toBe(message);
    });

    it("limits the length to that of the registry's roles", () => {
        const path = "/ga4gh/registry/v1/services";
        const max = maxServiceIdLength(path);
        expect(max).toBe(1024 - path.length - 1);
        expect(serviceIdError("a".repeat(max), path)).toBeUndefined();
        // characters, not UTF-16 code units, as the registry counts them
        expect(serviceIdError("😀".repeat(max), path)).toBeUndefined();
        expect(serviceIdError("a".repeat(max + 1), path)).toBe(
            `Service ID must be at most ${max} characters.`,
        );
        // without the path, the registry checks the length
        expect(serviceIdError("a".repeat(2000))).toBeUndefined();
    });
});
