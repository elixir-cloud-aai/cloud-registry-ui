import { describe, expect, it } from "vitest";
import { headerSortState } from "./header-helper";

describe("headerSortState", () => {
    it("shows no order for other columns", () => {
        expect(headerSortState({ key: "name", order: "asc" }, "id")).toBe(
            "none",
        );
    });

    it.each([
        ["asc", "ascending"],
        ["desc", "descending"],
    ] as const)("shows %s as %s for the column", (order, state) => {
        expect(headerSortState({ key: "version", order }, "version")).toBe(
            state,
        );
    });
});
