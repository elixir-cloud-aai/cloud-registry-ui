import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Requests of a component of which only the latest counts, e.g. of a loader
 * that loads anew: each one aborts the one before, and unmounting aborts the
 * last, so that their answers can't replace newer ones and their failures
 * aren't reported (see `isAborted`)
 * @returns The same object on every render, for the dependencies of
 * hooks: `next`: abort the current request, and get the signal of the next
 * one; `abort`: abort the current one, e.g. when an answer from elsewhere
 * replaces it
 */
function useLatestRequest() {
    const controller = useRef<AbortController | null>(null);
    const abort = useCallback(() => controller.current?.abort(), []);
    const next = useCallback(() => {
        controller.current?.abort();
        controller.current = new AbortController();
        return controller.current.signal;
    }, []);
    useEffect(() => abort, [abort]);
    return useMemo(() => ({ next, abort }), [next, abort]);
}

export { useLatestRequest };
