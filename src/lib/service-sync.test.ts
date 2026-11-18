import { describe, expect, it } from "vitest";
import { failure } from "@/test/errors";
import type { ServiceSync } from "./cloud-registry.types";
import {
    formatSyncTime,
    syncedServices,
    syncFailedReason,
    syncFailedTitle,
    syncFrequency,
    syncNowError,
    syncNowMessage,
    syncReasonText,
    syncStartedMessage,
} from "./service-sync";

const synced: ServiceSync = {
    url: "https://tes.example.org",
    type: { group: "org.ga4gh", artifact: "tes", version: "1.1.0" },
    status: "synced",
    serviceInfoId: "org.example.tes",
};

describe("syncedServices", () => {
    const service = {
        id: "a",
        name: "A",
        url: synced.url,
        type: synced.type,
        organization: { name: "Org", url: "https://example.org" },
        version: "1.0.0",
    };
    const state = { ...synced, serviceId: "a" };

    it("takes the states of services as they were synced", () => {
        expect(syncedServices([service], [state]).get("a")).toBe(state);
    });

    it("leaves out services that changed, and unknown ones", () => {
        expect(
            syncedServices(
                [{ ...service, url: "https://other.example.org" }],
                [state],
            ).size,
        ).toBe(0);
        expect(syncedServices([], [state]).size).toBe(0);
    });
});

describe("formatSyncTime", () => {
    it("formats a time, and says so if there is none", () => {
        expect(formatSyncTime("2026-11-05T12:00:00Z")).toContain("2026");
        expect(formatSyncTime()).toBe("Never");
    });
});

describe("syncFrequency", () => {
    it.each([
        [1, "every hour"],
        [6, "every 6 hours"],
        [36, "every 36 hours"],
        [0.5, "every 0.5 hours"],
        [24, "every day"],
        [48, "every 2 days"],
    ])("describes %d hours as %s", (hours, text) => {
        expect(syncFrequency(hours)).toBe(text);
    });
});

describe("syncReasonText", () => {
    it("explains the registry's reasons", () => {
        expect(syncReasonText("unreachable")).toContain("can't be fetched");
        expect(syncReasonText("version awaiting approval")).toContain(
            "approval",
        );
    });

    it("tells to contact the operators without a reason", () => {
        expect(syncReasonText(undefined)).toContain("operators");
    });

    it("shows no text from the registry for reasons it doesn't know", () => {
        expect(syncReasonText("connect ECONNREFUSED 10.0.0.1:443")).toBe(
            "the service info can't be applied.",
        );
        // nor names of `Object.prototype`
        expect(syncReasonText("constructor")).toBe(
            "the service info can't be applied.",
        );
    });
});

describe("syncStartedMessage", () => {
    it("confirms a sync that worked", () => {
        expect(syncStartedMessage(synced).kind).toBe("success");
    });

    it("warns if the values can't be applied", () => {
        const { kind, message } = syncStartedMessage({
            ...synced,
            status: "out-of-sync",
            reason: "version not allowed",
        });
        expect(kind).toBe("warning");
        expect(message).toContain("Sync is on");
        expect(message).toContain("only admins may add it");
    });
});

describe("syncFailedTitle", () => {
    it("says that sync is off if the registry answered", () => {
        expect(syncFailedTitle(failure(502, {}))).toContain("sync is off");
    });

    it("doesn't claim that without an answer", () => {
        expect(syncFailedTitle(new TypeError("Failed to fetch"))).toContain(
            "can't tell",
        );
        expect(syncFailedTitle(undefined)).toContain("can't tell");
    });
});

describe("syncFailedReason", () => {
    it("tells nothing about why a fetch failed", () => {
        expect(syncFailedReason(failure(502, { detail: "raw" }))).toContain(
            "could not fetch the service info",
        );
    });

    it("asks to wait above the limit", () => {
        expect(syncFailedReason(failure(429))).toContain("too often");
        expect(syncFailedReason(failure(429))).toContain("try again later");
    });

    it("says which limit, and how long to wait", () => {
        const detail =
            "The registry fetched the service info of this service less than 60 seconds ago; try again later.";
        expect(
            syncFailedReason(failure(429, { detail, retryAfter: 42 })),
        ).toBe(`${detail} Please try again in 42 seconds.`);
    });

    it("names the field of invalid service info", () => {
        expect(
            syncFailedReason(failure(400, { detail: "'url' must be a URL" })),
        ).toBe("'Service URL' must be a URL");
        expect(syncFailedReason(failure(400))).toContain("checks");
    });

    it.each([
        ["sync-unavailable", "doesn't sync"],
        ["sync-identity-mismatch", "another type of service"],
        ["service-busy", "try again"],
    ])("explains the conflict %s", (code, text) => {
        expect(syncFailedReason(failure(409, { code }))).toContain(text);
    });

    it("shows the registry's detail for other conflicts", () => {
        expect(syncFailedReason(failure(409, { detail: "Other." }))).toBe(
            "Other.",
        );
    });

    it("falls back to the message for failed changes", () => {
        expect(syncFailedReason(failure(401))).toContain("log in again");
        expect(syncFailedReason(failure(403))).toBe(
            "Only owners, maintainers and admins of this service can sync it.",
        );
        expect(syncFailedReason(new Error("x"))).toBe(
            "Cannot sync this service currently.",
        );
    });
});

describe("syncNowMessage", () => {
    it("confirms a sync that applied the service info", () => {
        const { kind, message } = syncNowMessage(synced);
        expect(kind).toBe("success");
        expect(message).toContain("Synced");
        expect(message).not.toContain("Sync is on");
    });

    it.each<Partial<ServiceSync>>([
        { status: "out-of-sync", reason: "version not allowed" },
        { status: "synced", reason: "version not allowed" },
    ])("warns if the values can't be applied: %o", (state) => {
        const { kind, message } = syncNowMessage({ ...synced, ...state });
        expect(kind).toBe("warning");
        expect(message).toContain("can't be applied");
        expect(message).toContain("only admins may add it");
    });
});

describe("syncNowError", () => {
    const unchanged = "Nothing changed";

    it.each([
        [failure(502), "could not fetch the service info"],
        [failure(400), "checks"],
        [failure(409, { code: "sync-identity-mismatch" }), "another type"],
        [failure(409, { code: "service-busy" }), "try again"],
        [failure(409, { code: "sync-unavailable" }), "doesn't sync"],
    ])("says that nothing changed: %o", (err, text) => {
        const { message, description, retryAfter } = syncNowError(err);
        expect(message).toContain(text);
        expect(description).toContain(unchanged);
        expect(retryAfter).toBeUndefined();
    });

    it("says how long to wait, and that nothing was fetched", () => {
        const { message, description, retryAfter } = syncNowError(
            failure(429, { detail: "Too soon.", retryAfter: 42 }),
        );
        expect(message).toBe("Too soon. Please try again in 42 seconds.");
        expect(description).toContain("Nothing was fetched");
        expect(retryAfter).toBe(42);
    });

    it("has no wait if the registry sends none", () => {
        expect(syncNowError(failure(429)).retryAfter).toBeUndefined();
    });

    it.each([
        [failure(401), "log in again"],
        [failure(403), "Only owners, maintainers and admins"],
        [new TypeError("Failed to fetch"), "Cannot sync"],
    ])("claims nothing about changes otherwise: %o", (err, text) => {
        const { message, description } = syncNowError(err);
        expect(message).toContain(text);
        expect(description).toBeUndefined();
    });
});
