import { describe, expect, it } from "vitest";
import type { Failure } from "./cloud-registry.types";
import {
    appendFailures,
    failedOperations,
    failureReasonLabel,
    failureReasons,
    failureReasonText,
    failuresError,
    failuresHref,
    failuresPath,
    failuresQuery,
    operationLabel,
    readFailuresFilter,
} from "./failures";

const failure = (id: string): Failure => ({
    id,
    occurredAt: "2026-11-05T12:34:56.789Z",
    operation: "import",
    reason: "fetch failed",
});

describe("operationLabel", () => {
    it.each([
        ["import", "Import"],
        ["register", "Registration"],
        ["update", "Update"],
        ["sync", "Sync"],
    ])("names %s", (operation, label) => {
        expect(operationLabel(operation)).toBe(label);
    });

    it("names operations that the app doesn't know, without the registry's text", () => {
        expect(operationLabel("<b>delete</b>")).toBe("Other operation");
        expect(operationLabel("toString")).toBe("Other operation");
    });

    it("has a label for each operation of the filter", () => {
        for (const operation of failedOperations)
            expect(operationLabel(operation)).not.toBe("Other operation");
    });
});

describe("failureReasonText", () => {
    it("explains every reason of the registry with a fixed text", () => {
        const texts = failureReasons.map(failureReasonText);
        expect(new Set(texts).size).toBe(failureReasons.length);
        for (const text of texts) {
            expect(text).toMatch(/^[A-Z]/);
            expect(text).toMatch(/\.$/);
        }
    });

    it("says that only admins see why a fetch failed", () => {
        expect(failureReasonText("fetch failed")).toContain("admins");
    });

    it("tells unreachable services from addresses that aren't allowed", () => {
        expect(failureReasonText("unreachable")).toContain("fetch");
        expect(failureReasonText("address not allowed")).toContain("address");
    });

    it("has a fixed text for reasons that the app doesn't know", () => {
        expect(failureReasonText("<img src=x>")).toBe(
            "The operation failed for a reason that this version of the app doesn't know.",
        );
        expect(failureReasonText("constructor")).toBe(
            failureReasonText("unknown"),
        );
    });
});

describe("failureReasonLabel", () => {
    it("names every reason of the registry", () => {
        expect(failureReasonLabel("url locked by sync")).toBe(
            "URL locked by sync",
        );
        const labels = failureReasons.map(failureReasonLabel);
        expect(new Set(labels).size).toBe(failureReasons.length);
        expect(labels).not.toContain("Other reason");
        for (const [i, label] of labels.entries())
            expect(label.toLowerCase()).toBe(failureReasons[i]?.toLowerCase());
    });

    it("has a fixed name for reasons that the app doesn't know", () => {
        expect(failureReasonLabel("<b>new</b>")).toBe("Other reason");
        expect(failureReasonLabel("valueOf")).toBe("Other reason");
    });
});

describe("readFailuresFilter", () => {
    it("reads the filters of the address", () => {
        const params = new URLSearchParams(
            "operation=sync&reason=not+JSON&serviceId=a%2Fb",
        );
        expect(readFailuresFilter(params)).toEqual({
            operation: "sync",
            reason: "not JSON",
            serviceId: "a/b",
        });
    });

    it("drops values that the registry would refuse", () => {
        const params = new URLSearchParams(
            `operation=delete&reason=oops&serviceId=${"x".repeat(1025)}`,
        );
        expect(readFailuresFilter(params)).toEqual({});
        expect(readFailuresFilter(new URLSearchParams("serviceId="))).toEqual(
            {},
        );
    });

    it("has no filters without parameters", () => {
        expect(readFailuresFilter(new URLSearchParams())).toEqual({});
    });
});

describe("failuresQuery", () => {
    it("has nothing without filters and pages", () => {
        expect(failuresQuery({})).toBe("");
    });

    it("has the filters and the page, encoded", () => {
        expect(
            failuresQuery(
                {
                    operation: "update",
                    reason: "invalid field",
                    serviceId: "a/b&c",
                },
                { pageSize: 50, pageToken: "1.abc" },
            ),
        ).toBe(
            "?operation=update&reason=invalid+field&serviceId=a%2Fb%26c&pageSize=50&pageToken=1.abc",
        );
    });
});

describe("failuresHref", () => {
    it("leads to the view, with the filters", () => {
        expect(failuresHref()).toBe(failuresPath);
        expect(failuresHref({ serviceId: "tes north" })).toBe(
            `${failuresPath}?serviceId=tes+north`,
        );
    });
});

describe("appendFailures", () => {
    it("appends the next page, without those listed already", () => {
        const list = [failure("a"), failure("b")];
        expect(
            appendFailures(list, [failure("b"), failure("c")]).map(
                (val) => val.id,
            ),
        ).toEqual(["a", "b", "c"]);
    });
});

describe("failuresError", () => {
    const err = (status: number, detail?: string) =>
        Object.assign(new Error(detail ?? "failed"), { status, detail });

    it("asks to log in again for an expired login", () => {
        expect(failuresError(err(401))).toEqual({
            kind: "login",
            message: "Your session expired. Please log in again.",
        });
    });

    it("says that registries without the list don't have it", () => {
        expect(failuresError(err(404)).kind).toBe("unsupported");
    });

    it("names the policy for refusals", () => {
        expect(failuresError(err(403))).toMatchObject({ kind: "forbidden" });
        expect(failuresError(err(403)).message).toContain("policy");
    });

    it("passes on the registry's detail of invalid requests", () => {
        expect(failuresError(err(400, "Invalid page token"))).toEqual({
            kind: "error",
            message: "Invalid page token",
        });
    });

    it("has a fixed text for other failures", () => {
        expect(failuresError(new Error("network"))).toEqual({
            kind: "error",
            message: "Could not load the failed operations. Please try again.",
        });
    });
});
