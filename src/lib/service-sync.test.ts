import { describe, expect, it } from "vitest";
import { failure } from "@/test/errors";
import type { ServiceSync } from "./cloud-registry.types";
import {
    formatSyncTime,
    syncedServices,
    syncFailedReason,
    syncFailedTitle,
    syncFrequency,
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
        expect(syncFailedReason(failure(403))).toContain("permission");
        expect(syncFailedReason(new Error("x"))).toBe(
            "Cannot sync this service currently.",
        );
    });
});
