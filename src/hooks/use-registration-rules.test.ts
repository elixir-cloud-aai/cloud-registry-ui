import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    defaultRegistrationRules,
    unknownRegistrationRules,
} from "@/lib/registration-rules";
import { react } from "@/test/react";

const registry = vi.hoisted(() => ({
    provider: null as null | {
        getServiceInfo: (options?: {
            signal?: AbortSignal;
        }) => Promise<unknown>;
    },
}));

// React's hooks, as the tests run in Node without a DOM
vi.mock("react", async () => (await import("@/test/react")).reactMock);
vi.mock("./use-cloud-registry", () => ({
    useCloudRegistry: () => ({ cloudRegistryProvider: registry.provider }),
}));

const { useRegistrationRules } = await import("./use-registration-rules");

/**
 * A read of the service info that ends only when it is aborted, as
 * browsers' requests do
 * @returns The read, and the signals that it got
 */
function pendingRead() {
    const signals: (AbortSignal | undefined)[] = [];
    const getServiceInfo = (options: { signal?: AbortSignal } = {}) => {
        signals.push(options.signal);
        return new Promise<never>((_, reject) =>
            options.signal?.addEventListener("abort", () =>
                reject(options.signal?.reason),
            ),
        );
    };
    return { getServiceInfo, signals };
}

beforeEach(() => {
    react.reset();
    registry.provider = null;
});

describe("useRegistrationRules", () => {
    it("has the defaults while the rules load", () => {
        registry.provider = pendingRead();
        const hook = react.render(useRegistrationRules);
        expect(hook).toEqual({
            rules: defaultRegistrationRules,
            loading: true,
            error: false,
        });
    });

    it("has the registry's rules once they are loaded", async () => {
        registry.provider = {
            getServiceInfo: async () => ({
                registrationRules: { environments: ["qa"] },
            }),
        };
        react.render(useRegistrationRules);
        await vi.waitFor(() =>
            expect(react.render(useRegistrationRules).loading).toBe(false),
        );
        const hook = react.render(useRegistrationRules);
        expect(hook.rules.environments).toEqual(["qa"]);
        expect(hook.error).toBe(false);
    });

    it("leaves the checks to the registry if the rules are unknown", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        registry.provider = {
            getServiceInfo: () => Promise.reject(new Error("down")),
        };
        react.render(useRegistrationRules);
        await vi.waitFor(() =>
            expect(react.render(useRegistrationRules).error).toBe(true),
        );
        expect(react.render(useRegistrationRules).rules).toEqual(
            unknownRegistrationRules,
        );
    });

    it("aborts the read on unmount, without a log", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const read = pendingRead();
        registry.provider = read;
        react.render(useRegistrationRules);
        expect(read.signals).toHaveLength(1);
        expect(read.signals[0]?.aborted).toBe(false);
        react.unmount();
        expect(read.signals[0]?.aborted).toBe(true);
        // the aborted read settles
        await new Promise((resolve) => setTimeout(resolve));
        expect(error).not.toHaveBeenCalled();
    });

    it("waits for the registry's client", () => {
        expect(react.render(useRegistrationRules).loading).toBe(true);
    });
});
