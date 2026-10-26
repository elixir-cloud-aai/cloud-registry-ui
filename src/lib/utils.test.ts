import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
    it("joins classes, later Tailwind classes winning", () => {
        expect(cn("p-2", false && "hidden", ["text-sm", "p-4"])).toBe(
            "text-sm p-4",
        );
    });
});
