import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("copyText", () => {
    it("writes to the clipboard", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        await copyText("x");
        expect(writeText).toHaveBeenCalledWith("x");
    });

    it("rejects without a clipboard", async () => {
        vi.stubGlobal("navigator", {});
        await expect(copyText("x")).rejects.toThrow("No clipboard");
    });

    it("rejects if writing fails", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("denied"));
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        await expect(copyText("x")).rejects.toThrow("denied");
    });
});
