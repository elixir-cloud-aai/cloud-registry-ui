import { beforeEach, describe, expect, it, vi } from "vitest";
import { react } from "@/test/react";

const registry = vi.hoisted(() => ({
    cookie: "token" as string | undefined,
    signals: [] as (AbortSignal | undefined)[],
    answer: undefined as undefined | (() => Promise<unknown>),
}));

// React's hooks, as the tests run in Node without a DOM
vi.mock("react", async () => (await import("@/test/react")).reactMock);
vi.mock("cookies-next/client", () => ({ getCookie: () => registry.cookie }));
// a read of the user that ends only when it is aborted, as browsers'
// requests do, unless the test gives an answer
const provider = {
    getCurrentUser: ({ signal }: { signal?: AbortSignal } = {}) => {
        registry.signals.push(signal);
        if (registry.answer) return registry.answer();
        return new Promise<never>((_, reject) =>
            signal?.addEventListener("abort", () => reject(signal.reason)),
        );
    },
};
vi.mock("./use-cloud-registry", () => ({
    useCloudRegistry: () => ({ cloudRegistryProvider: provider }),
}));

const { useMe } = await import("./use-me");

beforeEach(() => {
    react.reset();
    registry.cookie = "token";
    registry.signals = [];
    registry.answer = undefined;
});

describe("useMe", () => {
    it("loads the user", async () => {
        registry.answer = async () => ({ userId: "u" });
        react.render(useMe);
        await vi.waitFor(() => expect(react.render(useMe).loading).toBe(false));
        expect(react.render(useMe).me).toEqual({ userId: "u" });
    });

    it("ignores reads that the browser aborts", async () => {
        registry.answer = () =>
            Promise.reject(new DOMException("aborted", "AbortError"));
        react.render(useMe);
        await new Promise((resolve) => setTimeout(resolve));
        expect(react.render(useMe)).toMatchObject({ error: false });
    });

    it("aborts the read on unmount", () => {
        react.render(useMe);
        expect(registry.signals[0]?.aborted).toBe(false);
        react.unmount();
        expect(registry.signals[0]?.aborted).toBe(true);
    });

    it("aborts the read on a refetch, which replaces it", () => {
        const { refetch } = react.render(useMe);
        refetch();
        expect(registry.signals).toHaveLength(2);
        expect(registry.signals[0]?.aborted).toBe(true);
        expect(registry.signals[1]?.aborted).toBe(false);
    });

    it("aborts the read once logged out", () => {
        const { refetch } = react.render(useMe);
        registry.cookie = undefined;
        refetch();
        expect(registry.signals[0]?.aborted).toBe(true);
        expect(react.render(useMe)).toMatchObject({ me: null, loading: false });
    });
});
