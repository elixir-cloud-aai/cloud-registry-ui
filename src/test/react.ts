/**
 * @description a minimal stand-in for React's hooks, for the unit tests of
 * hooks, which run in Node without a DOM: state, refs, callbacks and memos
 * persist across renders, and an effect runs on the first render and
 * whenever its dependencies change, after the cleanup of its previous run,
 * as React does it. Mock React with it in a test file:
 * `vi.mock("react", async () => (await import("@/test/react")).reactMock)`
 */

type Effect = () => undefined | (() => void);

let states: unknown[] = [];
let deps: (unknown[] | undefined)[] = [];
let cleanups: ((() => void) | undefined)[] = [];
let stateIndex = 0;
let effectIndex = 0;
const effects: [number, Effect][] = [];

/**
 * Whether the dependencies of a hook changed, as React tells
 * @param previous Those of the previous render, if any
 * @param next Those of this render, if any
 * @returns Whether the hook runs anew
 */
function changed(previous?: unknown[], next?: unknown[]) {
    return (
        previous === undefined ||
        next === undefined ||
        next.length !== previous.length ||
        next.some((value, i) => !Object.is(value, previous[i]))
    );
}

/**
 * Run the effects of the last render, each after the cleanup of its
 * previous run
 * @returns How many ran
 */
function runEffects() {
    const pending = effects.splice(0);
    for (const [index, effect] of pending) {
        cleanups[index]?.();
        cleanups[index] = effect() ?? undefined;
    }
    return pending.length;
}

const react = {
    /** Forget the state and effects of earlier renders, without cleanups */
    reset() {
        states = [];
        deps = [];
        cleanups = [];
        effects.splice(0);
    },
    /**
     * Render a hook, run its effects, and render it again with the new
     * state, as React would
     * @param hook The hook
     * @returns What the hook returns on the last render
     */
    render<T>(hook: () => T): T {
        stateIndex = 0;
        effectIndex = 0;
        const result = hook();
        if (runEffects() === 0) return result;
        stateIndex = 0;
        effectIndex = 0;
        const rerendered = hook();
        effects.splice(0);
        return rerendered;
    },
    /** Unmount: run the cleanups of the effects, and forget the state */
    unmount() {
        for (const cleanup of cleanups) cleanup?.();
        react.reset();
    },
    useState<T>(initial: T) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        const set = (value: T) => {
            states[index] = value;
        };
        return [states[index] as T, set] as const;
    },
    useRef<T>(initial: T) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = { current: initial };
        return states[index] as { current: T };
    },
    useCallback<T>(callback: T, next: unknown[]) {
        const index = stateIndex++;
        const previous = states[index] as [T, unknown[]] | undefined;
        if (previous && !changed(previous[1], next)) return previous[0];
        states[index] = [callback, next];
        return callback;
    },
    useMemo<T>(factory: () => T, next: unknown[]) {
        const index = stateIndex++;
        const previous = states[index] as [T, unknown[]] | undefined;
        if (previous && !changed(previous[1], next)) return previous[0];
        const value = factory();
        states[index] = [value, next];
        return value;
    },
    useEffect(effect: Effect, next?: unknown[]) {
        const index = effectIndex++;
        if (changed(deps[index], next)) {
            deps[index] = next;
            effects.push([index, effect]);
        }
    },
};

/** The module that mocks React */
const reactMock = {
    useState: react.useState,
    useRef: react.useRef,
    useCallback: react.useCallback,
    useMemo: react.useMemo,
    useEffect: react.useEffect,
};

export { react, reactMock };
