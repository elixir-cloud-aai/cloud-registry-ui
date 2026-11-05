import { describe, expect, it, vi } from "vitest";
import { failure } from "@/test/errors";

// the error of an aborted read
const aborted = () => new DOMException("aborted", "AbortError");

import {
    getApprovalsOrNull,
    getServiceWithApproval,
    withPendingServices,
    withPendingTypes,
} from "./approvals";
import type { AuthenticatedCloudRegistryProvider } from "./authenticated-cloud-registry";
import type {
    Approvals,
    ExternalService,
    ServiceType,
} from "./cloud-registry.types";

const type = (artifact: string): ServiceType => ({
    group: "org.ga4gh",
    artifact,
    version: "1.0.0",
});
const service = (id: string) => ({ id }) as ExternalService;
const approvals: Approvals = {
    serviceTypes: [type("wes")],
    services: [service("pending")],
};

function provider(
    overrides: Partial<{
        isAuthenticated: boolean;
        hasApprovals: () => Promise<boolean>;
        getApprovals: (options?: {
            signal?: AbortSignal;
        }) => Promise<Approvals>;
        getServiceById: (
            id: string,
            options?: { signal?: AbortSignal },
        ) => Promise<ExternalService>;
    }> = {},
) {
    return {
        isAuthenticated: true,
        hasApprovals: async () => true,
        getApprovals: async () => approvals,
        getServiceById: async (id: string) => service(id),
        ...overrides,
    } as unknown as AuthenticatedCloudRegistryProvider;
}

describe("getApprovalsOrNull", () => {
    const none = { serviceTypes: [], services: [] };

    it("gets the pending entries", async () => {
        expect(await getApprovalsOrNull(provider())).toBe(approvals);
    });

    it("has none for guests and registries without approvals", async () => {
        const getApprovals = vi.fn();
        expect(
            await getApprovalsOrNull(
                provider({ isAuthenticated: false, getApprovals }),
            ),
        ).toEqual(none);
        expect(
            await getApprovalsOrNull(
                provider({ hasApprovals: async () => false, getApprovals }),
            ),
        ).toEqual(none);
        expect(getApprovals).not.toHaveBeenCalled();
    });

    it.each([401, 403, 404])("has none after a %i", async (status) => {
        const result = await getApprovalsOrNull(
            provider({ getApprovals: () => Promise.reject(failure(status)) }),
        );
        expect(result).toEqual(none);
    });

    it("is null after other failures", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(
            await getApprovalsOrNull(
                provider({ getApprovals: () => Promise.reject(failure(500)) }),
            ),
        ).toBeNull();
        expect(log).toHaveBeenCalled();
    });

    it("is null without a log when aborted during the probe", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const controller = new AbortController();
        const getApprovals = vi.fn();
        const hasApprovals = () => {
            controller.abort();
            return Promise.reject(new TypeError("Failed to fetch"));
        };
        expect(
            await getApprovalsOrNull(provider({ hasApprovals, getApprovals }), {
                signal: controller.signal,
            }),
        ).toBeNull();
        expect(getApprovals).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
    });

    it("is null without a log when aborted", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const { signal } = new AbortController();
        const getApprovals = vi.fn(() => Promise.reject(aborted()));
        expect(
            await getApprovalsOrNull(provider({ getApprovals }), { signal }),
        ).toBeNull();
        expect(getApprovals).toHaveBeenCalledWith({ signal });
        expect(log).not.toHaveBeenCalled();
    });
});

describe("withPendingServices and withPendingTypes", () => {
    it("adds the pending entries that aren't listed", () => {
        expect(
            withPendingServices([service("a")], {
                ...approvals,
                services: [service("a"), service("b")],
            }).map((val) => val.id),
        ).toEqual(["a", "b"]);
        expect(withPendingServices([service("a")], null)).toHaveLength(1);
    });

    it("sorts the types as the registry does", () => {
        expect(
            withPendingTypes([type("tes"), type("drs")], {
                ...approvals,
                serviceTypes: [type("wes"), type("tes")],
            }).map((val) => val.artifact),
        ).toEqual(["drs", "tes", "wes"]);
        expect(withPendingTypes([type("tes")], null)).toHaveLength(1);
    });
});

describe("getServiceWithApproval", () => {
    it("gets a listed service, not pending", async () => {
        expect(await getServiceWithApproval(provider(), "a")).toEqual({
            service: service("a"),
            pending: false,
        });
    });

    it("gets a pending service from the approvals", async () => {
        const result = await getServiceWithApproval(
            provider({ getServiceById: () => Promise.reject(failure(404)) }),
            "pending",
        );
        expect(result).toEqual({ service: service("pending"), pending: true });
    });

    it("rethrows the 404 of a service that isn't pending", async () => {
        const notFound = failure(404);
        await expect(
            getServiceWithApproval(
                provider({ getServiceById: () => Promise.reject(notFound) }),
                "gone",
            ),
        ).rejects.toBe(notFound);
    });

    it("doesn't know if a service is pending without the approvals", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const broken = { getApprovals: () => Promise.reject(failure(500)) };
        expect(await getServiceWithApproval(provider(broken), "a")).toEqual({
            service: service("a"),
            pending: undefined,
        });
        await expect(
            getServiceWithApproval(
                provider({
                    ...broken,
                    getServiceById: () => Promise.reject(failure(404)),
                }),
                "a",
            ),
        ).rejects.toThrow("Could not load the pending services.");
    });

    it("rethrows expired logins and other failures of the service", async () => {
        const expired = failure(401);
        await expect(
            getServiceWithApproval(
                provider({ getApprovals: () => Promise.reject(expired) }),
                "a",
            ),
        ).rejects.toBe(expired);
        const outage = failure(500);
        await expect(
            getServiceWithApproval(
                provider({ getServiceById: () => Promise.reject(outage) }),
                "a",
            ),
        ).rejects.toBe(outage);
    });

    it("rethrows the abort of the approvals without a log", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const { signal } = new AbortController();
        const getServiceById = vi.fn(async (id: string) => service(id));
        await expect(
            getServiceWithApproval(
                provider({
                    getServiceById,
                    getApprovals: () => Promise.reject(aborted()),
                }),
                "a",
                { signal },
            ),
        ).rejects.toMatchObject({ name: "AbortError" });
        expect(getServiceById).toHaveBeenCalledWith("a", { signal });
        expect(log).not.toHaveBeenCalled();
    });
});
