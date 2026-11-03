import { beforeEach, describe, expect, it, vi } from "vitest";

const name = "NEXT_PUBLIC_ACCESS_PAGE_SIZE";
const labelName = "NEXT_PUBLIC_INVITATION_LABEL_REQUIRED";

// settings of the test process must not leak into the tests: the module of
// the settings keeps the values it finds when it loads
async function load() {
    vi.resetModules();
    return import("./access-settings");
}

beforeEach(() => {
    vi.stubEnv(name, undefined);
    vi.stubEnv(labelName, undefined);
});

describe("accessPageSize", () => {
    it("defaults to 5", async () => {
        const { accessPageSize } = await load();
        expect(accessPageSize()).toBe(5);
    });

    it("takes a blank setting as unset", async () => {
        const { accessPageSize } = await load();
        vi.stubEnv(name, " ");
        expect(accessPageSize()).toBe(5);
    });

    it.each([
        ["4", 4],
        ["1", 1],
        ["20", 20],
    ])("reads %s", async (value, size) => {
        const { accessPageSize } = await load();
        vi.stubEnv(name, value);
        expect(accessPageSize()).toBe(size);
    });

    it("reads the setting when called", async () => {
        const { accessPageSize } = await load();
        vi.stubEnv(name, "4");
        expect(accessPageSize()).toBe(4);
        vi.stubEnv(name, "6");
        expect(accessPageSize()).toBe(6);
    });

    it("falls back to the default for invalid values", async () => {
        const { accessPageSize } = await load();
        vi.stubEnv(name, "many");
        expect(accessPageSize()).toBe(5);
    });
});

describe("invitationLabelRequired", () => {
    it.each([undefined, "", " ", "true", " true "])(
        "requires it for %j",
        async (value) => {
            const { invitationLabelRequired } = await load();
            vi.stubEnv(labelName, value);
            expect(invitationLabelRequired()).toBe(true);
        },
    );

    it("doesn't require it for false", async () => {
        const { invitationLabelRequired } = await load();
        vi.stubEnv(labelName, "false");
        expect(invitationLabelRequired()).toBe(false);
    });

    it("falls back to the default for invalid values", async () => {
        const { invitationLabelRequired } = await load();
        vi.stubEnv(labelName, "maybe");
        expect(invitationLabelRequired()).toBe(true);
    });
});

describe("accessSettings", () => {
    it.each([undefined, "", " ", "1", "4", "20"])(
        "accepts %j",
        async (value) => {
            const { accessSettings } = await load();
            vi.stubEnv(name, value);
            expect(accessSettings).not.toThrow();
        },
    );

    it.each([
        "0",
        "-1",
        "2.5",
        "1e3",
        "many",
        "0x10",
        "5 pages",
        "9".repeat(20),
    ])("stops at %j, naming the setting", async (value) => {
        const { accessSettings } = await load();
        vi.stubEnv(name, value);
        expect(accessSettings).toThrow(
            `Invalid setting ${name}: "${value}" must be a whole number of at least 1`,
        );
    });

    it.each([undefined, "", " ", "true", "false"])(
        "accepts %j for the label",
        async (value) => {
            const { accessSettings } = await load();
            vi.stubEnv(labelName, value);
            expect(accessSettings).not.toThrow();
        },
    );

    it.each(["0", "1", "yes", "TRUE", "False"])(
        "stops at %j for the label, naming the setting",
        async (value) => {
            const { accessSettings } = await load();
            vi.stubEnv(labelName, value);
            expect(accessSettings).toThrow(
                `Invalid setting ${labelName}: "${value}" must be true or false`,
            );
        },
    );
});
