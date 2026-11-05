import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Requests of a component of which only the latest counts, e.g. of a loader
 * that loads anew: each one aborts the one before, and unmounting aborts the
 * last, so that their answers can't replace newer ones and their failures
 * aren't reported (see `isAborted`); requests after unmount, e.g. refreshes
 * after a change that ended later, are aborted from the start. Call it before
 * the effects that start requests, and start them in this component, not in
 * the effects of children, which React runs before this one
 * @returns The same object on every render, for the dependencies of
 * hooks: `next`: abort the current request, and get the signal of the next
 * one; `abort`: abort the current one, e.g. when an answer from elsewhere
 * replaces it
 */
function useLatestRequest() {
    const controller = useRef<AbortController | null>(null);
    const mounted = useRef(true);
    const abort = useCallback(() => controller.current?.abort(), []);
    const next = useCallback(() => {
        controller.current?.abort();
        controller.current = new AbortController();
        if (!mounted.current) controller.current.abort();
        return controller.current.signal;
    }, []);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            abort();
        };
    }, [abort]);
    return useMemo(() => ({ next, abort }), [next, abort]);
}

export { useLatestRequest };
