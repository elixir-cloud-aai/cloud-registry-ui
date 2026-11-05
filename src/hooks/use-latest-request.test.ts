import { beforeEach, describe, expect, it, vi } from "vitest";
import { react } from "@/test/react";

// React's hooks, as the tests run in Node without a DOM
vi.mock("react", async () => (await import("@/test/react")).reactMock);

const { useLatestRequest } = await import("./use-latest-request");

beforeEach(() => {
    react.reset();
});

describe("useLatestRequest", () => {
    it("aborts a request when the next one starts", () => {
        const { next } = react.render(useLatestRequest);
        const first = next();
        expect(first.aborted).toBe(false);
        const second = react.render(useLatestRequest).next();
        expect(first.aborted).toBe(true);
        expect(second.aborted).toBe(false);
    });

    it("aborts the current request on demand", () => {
        const { next, abort } = react.render(useLatestRequest);
        const signal = next();
        abort();
        expect(signal.aborted).toBe(true);
        expect(next().aborted).toBe(false);
    });

    it("aborts the current request on unmount", () => {
        const signal = react.render(useLatestRequest).next();
        react.unmount();
        expect(signal.aborted).toBe(true);
    });

    it("is the same across renders", () => {
        const first = react.render(useLatestRequest);
        expect(react.render(useLatestRequest)).toBe(first);
    });

    it("has nothing to abort before the first request", () => {
        const { abort } = react.render(useLatestRequest);
        expect(() => abort()).not.toThrow();
        expect(() => react.unmount()).not.toThrow();
    });
});
