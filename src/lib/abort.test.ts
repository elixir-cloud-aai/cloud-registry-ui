import { describe, expect, it } from "vitest";
import { anySignal, isAborted } from "./abort";

describe("isAborted", () => {
    it("tells aborted requests from other failures", () => {
        expect(isAborted(new DOMException("aborted", "AbortError"))).toBe(true);
        expect(isAborted(new DOMException("timed out", "TimeoutError"))).toBe(
            false,
        );
        expect(isAborted(new TypeError("Failed to fetch"))).toBe(false);
        expect(isAborted({ name: "AbortError" })).toBe(true);
        expect(isAborted("AbortError")).toBe(false);
        expect(isAborted(null)).toBe(false);
    });

    it("knows the reason of an aborted controller", () => {
        const controller = new AbortController();
        controller.abort();
        expect(isAborted(controller.signal.reason)).toBe(true);
    });
});

describe("anySignal", () => {
    it("aborts with the reason of the first signal that aborts", () => {
        const first = new AbortController();
        const second = new AbortController();
        const signal = anySignal([first.signal, second.signal]);
        expect(signal.aborted).toBe(false);
        second.abort("second");
        first.abort("first");
        expect(signal.aborted).toBe(true);
        expect(signal.reason).toBe("second");
    });

    it("is aborted if a signal is aborted already", () => {
        const signal = anySignal([
            new AbortController().signal,
            AbortSignal.abort("done"),
        ]);
        expect(signal.aborted).toBe(true);
        expect(signal.reason).toBe("done");
    });
});
