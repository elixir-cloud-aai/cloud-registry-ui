/**
 * @description requests that are aborted, not failed: loaders abort their
 * requests when their component unmounts or loads anew (`AbortController`),
 * and browsers abort those of a page that they leave. Neither is an error
 * to log or show
 */

/**
 * Whether an error is the abort of a request, by the app or by the browser;
 * not a timeout (`TimeoutError`), which is a failure
 * @param err Error of a request
 * @returns Whether it is an `AbortError`
 */
function isAborted(err: unknown) {
    return (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        err.name === "AbortError"
    );
}

/**
 * Combine signals, as `AbortSignal.any()` does, which older browsers lack
 * @param signals Signals
 * @returns A signal that aborts with the first of them, with its reason
 */
function anySignal(signals: AbortSignal[]) {
    const controller = new AbortController();
    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort(signal.reason);
            break;
        }
        // removed once the combined signal aborts
        signal.addEventListener(
            "abort",
            () => controller.abort(signal.reason),
            { once: true, signal: controller.signal },
        );
    }
    return controller.signal;
}

export { anySignal, isAborted };
