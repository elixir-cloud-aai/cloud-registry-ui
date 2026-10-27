import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal stand-in for React's hooks: state persists across renders, and
// an effect runs on the first render and whenever its dependencies change,
// as React does it. The unit tests run in Node, without a DOM.
const react = vi.hoisted(() => {
    let states: unknown[] = [];
    let deps: (unknown[] | undefined)[] = [];
    let stateIndex = 0;
    let effectIndex = 0;
    const effects: (() => void)[] = [];
    return {
        reset() {
            states = [];
            deps = [];
        },
        render<T>(hook: () => T): T {
            stateIndex = 0;
            effectIndex = 0;
            const result = hook();
            // run effects after the render, then render again with the new
            // state, as React would
            const pending = effects.splice(0);
            for (const effect of pending) effect();
            if (pending.length === 0) return result;
            stateIndex = 0;
            effectIndex = 0;
            const rerendered = hook();
            effects.splice(0);
            return rerendered;
        },
        useState<T>(initial: T) {
            const index = stateIndex++;
            if (!(index in states)) states[index] = initial;
            const set = (value: T) => {
                states[index] = value;
            };
            return [states[index] as T, set] as const;
        },
        useEffect(effect: () => void, next?: unknown[]) {
            const index = effectIndex++;
            const previous = deps[index];
            const changed =
                previous === undefined ||
                next === undefined ||
                next.length !== previous.length ||
                next.some((value, i) => !Object.is(value, previous[i]));
            if (changed) {
                deps[index] = next;
                effects.push(effect);
            }
        },
    };
});
const cookies = vi.hoisted(() => new Map<string, string>());

vi.mock("react", () => ({
    useState: react.useState,
    useEffect: react.useEffect,
}));
vi.mock("cookies-next/client", () => ({
    getCookie: (name: string) => cookies.get(name),
}));
vi.mock("@/lib/authenticated-cloud-registry", () => ({
    AuthenticatedCloudRegistryProvider: class {
        constructor(
            readonly baseUrl: string,
            readonly token?: string,
        ) {}
    },
}));

const { useCloudRegistry } = await import("./use-cloud-registry");

type Provider = { baseUrl: string; token?: string };
const provider = (hook: ReturnType<typeof useCloudRegistry>) =>
    hook.cloudRegistryProvider as unknown as Provider;

beforeEach(() => {
    react.reset();
    cookies.clear();
    vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", "https://registry.test");
});

describe("useCloudRegistry", () => {
    it("builds an anonymous provider without a token", () => {
        const hook = react.render(useCloudRegistry);
        expect(hook.isLoggedIn).toBe(false);
        expect(provider(hook)).toEqual({
            baseUrl: "https://registry.test",
            token: undefined,
        });
    });

    it("falls back to an empty registry URL", () => {
        vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", "");
        cookies.set("access_token", "a");
        expect(provider(react.render(useCloudRegistry)).baseUrl).toBe("");
        cookies.clear();
        react.reset();
        expect(provider(react.render(useCloudRegistry)).baseUrl).toBe("");
    });

    it("uses the new token after login", () => {
        react.render(useCloudRegistry);
        cookies.set("access_token", "a");
        const hook = react.render(useCloudRegistry);
        expect(hook.isLoggedIn).toBe(true);
        expect(provider(hook).token).toBe("a");
    });

    it("uses the new token after it changes", () => {
        cookies.set("access_token", "a");
        react.render(useCloudRegistry);
        cookies.set("access_token", "b");
        expect(provider(react.render(useCloudRegistry)).token).toBe("b");
    });

    it("drops the token after logout", () => {
        cookies.set("access_token", "a");
        react.render(useCloudRegistry);
        cookies.clear();
        const hook = react.render(useCloudRegistry);
        expect(hook.isLoggedIn).toBe(false);
        expect(provider(hook).token).toBeUndefined();
    });
});
