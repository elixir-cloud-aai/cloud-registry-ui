import { describe, expect, it } from "vitest";
import type { AppNotification } from "./cloud-registry.types";
import { notificationCount, notificationView, timeAgo } from "./notifications";

const notification = (fields: Partial<AppNotification>): AppNotification => ({
    id: "1",
    type: "out-of-sync",
    reason: "unreachable",
    serviceId: "a/b",
    ...fields,
});

describe("notificationView", () => {
    it("names a service that is out of sync, and links to it", () => {
        const view = notificationView(notification({}), "TES");
        expect(view.title).toBe("TES is out of sync");
        expect(view.text).toMatch(/^The service info can't be fetched/);
        expect(view.href).toBe("/dashboard/services/view/a%2Fb");
    });

    it("falls back to the identifier without a name", () => {
        expect(notificationView(notification({})).title).toBe(
            "a/b is out of sync",
        );
    });

    it("tells to contact the operators if syncs aren't running", () => {
        expect(
            notificationView(notification({ reason: "no recent sync" })).text,
        ).toContain("operators");
    });

    it("links pending types to the page of types", () => {
        const view = notificationView(
            notification({
                type: "pending-service-type",
                reason: "awaiting approval",
                serviceId: undefined,
                serviceType: {
                    group: "org.ga4gh",
                    artifact: "tes",
                    version: "1.1.0",
                },
            }),
        );
        expect(view.title).toBe(
            "Service type org.ga4gh · tes · 1.1.0 awaits approval",
        );
        expect(view.href).toBe("/dashboard/service-types");
    });

    it("words a pending type without its name", () => {
        expect(
            notificationView(
                notification({
                    type: "pending-service-type",
                    serviceId: undefined,
                }),
            ).title,
        ).toBe("A service type awaits approval");
    });

    it("links pending services to their page", () => {
        const view = notificationView(
            notification({ type: "pending-service" }),
            "TES",
        );
        expect(view.title).toBe("TES awaits approval");
        expect(view.href).toBe("/dashboard/services/view/a%2Fb");
    });

    it.each([
        ["environment-not-allowed", "an environment"],
        ["url-scheme-not-allowed", "a URL scheme"],
    ] as const)("links %s to the edit form", (type, text) => {
        const view = notificationView(notification({ type }), "TES");
        expect(view.title).toContain(text);
        expect(view.href).toBe("/dashboard/services/update/a%2Fb");
    });

    it("shows nothing from the registry for unknown types and reasons", () => {
        const raw = "connect ECONNREFUSED 10.0.0.1:443";
        const unknownType = notificationView(
            notification({
                type: "something-new" as AppNotification["type"],
                reason: raw,
            }),
            "TES",
        );
        expect(unknownType.title).toBe("TES needs attention");
        expect(JSON.stringify(unknownType)).not.toContain(raw);
        const unknownReason = notificationView(notification({ reason: raw }));
        expect(unknownReason.text).not.toContain(raw);
    });

    it("has no link for unknown types without a service", () => {
        const view = notificationView(
            notification({
                type: "something-new" as AppNotification["type"],
                serviceId: undefined,
            }),
        );
        expect(view.title).toBe("Something needs attention");
        expect(view.href).toBeUndefined();
    });

    it("words other notifications without a service", () => {
        expect(
            notificationView(
                notification({ type: "pending-service", serviceId: undefined }),
            ).title,
        ).toBe("A service awaits approval");
    });
});

describe("notificationCount", () => {
    it("shows up to 99", () => {
        expect(notificationCount(3)).toBe("3");
        expect(notificationCount(99)).toBe("99");
        expect(notificationCount(100)).toBe("99+");
    });
});

describe("timeAgo", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");

    it.each([
        ["2026-11-05T11:59:50Z", "just now"],
        ["2026-11-05T11:58:00Z", "2 minutes ago"],
        ["2026-11-05T09:00:00Z", "3 hours ago"],
        ["2026-11-03T12:00:00Z", "2 days ago"],
        // clocks differ
        ["2026-11-05T12:00:10Z", "just now"],
    ])("describes %s as %s", (since, text) => {
        expect(timeAgo(since, now)).toBe(text);
    });

    it("says nothing if unknown", () => {
        expect(timeAgo(undefined, now)).toBeUndefined();
        expect(timeAgo("not a date", now)).toBeUndefined();
    });

    it("uses the current time by default", () => {
        expect(timeAgo(new Date().toISOString())).toBe("just now");
    });
});
