import { describe, expect, it, vi } from "vitest";
import { accessPageSize, accessSettings } from "./access-settings";

const name = "NEXT_PUBLIC_ACCESS_PAGE_SIZE";

describe("accessPageSize", () => {
    it("defaults to 5", () => {
        vi.stubEnv(name, undefined);
        expect(accessPageSize()).toBe(5);
    });

    it("takes a blank setting as unset", () => {
        vi.stubEnv(name, " ");
        expect(accessPageSize()).toBe(5);
    });

    it.each([
        ["4", 4],
        ["1", 1],
        ["20", 20],
    ])("reads %s", (value, size) => {
        vi.stubEnv(name, value);
        expect(accessPageSize()).toBe(size);
    });

    it("reads the setting when called", () => {
        vi.stubEnv(name, "4");
        expect(accessPageSize()).toBe(4);
        vi.stubEnv(name, "6");
        expect(accessPageSize()).toBe(6);
    });

    it("falls back to the default for invalid values", () => {
        vi.stubEnv(name, "many");
        expect(accessPageSize()).toBe(5);
    });
});

describe("accessSettings", () => {
    it.each([undefined, "", " ", "1", "4", "20"])("accepts %j", (value) => {
        vi.stubEnv(name, value);
        expect(accessSettings).not.toThrow();
    });

    it.each([
        "0",
        "-1",
        "2.5",
        "1e3",
        "many",
        "0x10",
        "5 pages",
        "9".repeat(20),
    ])("stops at %j, naming the setting", (value) => {
        vi.stubEnv(name, value);
        expect(accessSettings).toThrow(
            `Invalid setting ${name}: "${value}" must be a whole number of at least 1`,
        );
    });
});
