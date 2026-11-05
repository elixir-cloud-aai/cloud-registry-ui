import { describe, expect, it, vi } from "vitest";
import { failure } from "@/test/errors";
import {
    defaultRegistrationRules,
    environmentMessage,
    environmentRank,
    isAllowedEnvironment,
    readRegistrationRules,
    registrationRules,
    unknownRegistrationRules,
} from "./registration-rules";

const defaults = {
    environments: ["prod", "test", "dev", "staging"],
    urlSchemes: ["https"],
    serviceTypes: undefined,
    maxUnusedServiceTypes: undefined,
    maxServicesPerUser: undefined,
};

describe("registrationRules", () => {
    it("reads the published rules", () => {
        expect(
            registrationRules({
                id: "org.example.cloud-registry",
                registrationRules: {
                    environments: ["qa", "prod"],
                    urlSchemes: ["http", "https"],
                    serviceTypes: "moderated",
                    maxUnusedServiceTypes: 10,
                    maxServicesPerUser: 0,
                },
            }),
        ).toEqual({
            environments: ["qa", "prod"],
            urlSchemes: ["http", "https"],
            serviceTypes: "moderated",
            maxUnusedServiceTypes: 10,
            maxServicesPerUser: 0,
        });
    });

    it("reads whether and how often the registry syncs", () => {
        const serviceInfoSync = { enabled: true, intervalHours: 12 };
        expect(
            registrationRules({ registrationRules: { serviceInfoSync } })
                ?.serviceInfoSync,
        ).toEqual(serviceInfoSync);
    });

    it.each([
        ["missing", undefined],
        ["not an object", true],
        ["without a flag", { intervalHours: 12 }],
        ["without an interval", { enabled: true }],
        [
            "with an interval that isn't positive",
            { enabled: true, intervalHours: 0 },
        ],
    ])("takes a sync rule as unknown if it is %s", (_, serviceInfoSync) => {
        expect(
            registrationRules({ registrationRules: { serviceInfoSync } })
                ?.serviceInfoSync,
        ).toBeUndefined();
    });

    it("keeps an empty list of environments, for any value", () => {
        expect(
            registrationRules({ registrationRules: { environments: [] } })
                ?.environments,
        ).toEqual([]);
    });

    it("drops duplicate and empty environments and unknown schemes", () => {
        expect(
            registrationRules({
                registrationRules: {
                    environments: ["prod", "", "prod", ",", "test"],
                    urlSchemes: ["HTTPS", "ftp", "https"],
                },
            }),
        ).toMatchObject({
            environments: ["prod", "test"],
            urlSchemes: ["https"],
        });
    });

    it.each([
        [{}],
        [{ registrationRules: null }],
        [{ registrationRules: "x" }],
        [{ registrationRules: [] }],
        [null],
        ["x"],
    ])("has no rules for %j", (info) => {
        // registries older than cloud-registry 1.0.0rc2
        expect(registrationRules(info)).toBeUndefined();
    });

    it.each([
        [{ registrationRules: {} }],
        [
            {
                registrationRules: {
                    environments: ["prod", 1],
                    urlSchemes: ["ftp"],
                    serviceTypes: "closed",
                    maxUnusedServiceTypes: -1,
                    maxServicesPerUser: 1.5,
                },
            },
        ],
        [
            {
                registrationRules: {
                    environments: "prod",
                    urlSchemes: [],
                    maxUnusedServiceTypes: "5",
                    maxServicesPerUser: null,
                },
            },
        ],
    ])("falls back to the defaults for %j", (info) => {
        expect(registrationRules(info)).toEqual(defaults);
    });

    it("doesn't share the defaults' lists, which can't change", () => {
        const rules = registrationRules({ registrationRules: {} });
        expect(rules?.environments).not.toBe(
            defaultRegistrationRules.environments,
        );
        expect(Object.isFrozen(defaultRegistrationRules.environments)).toBe(
            true,
        );
        expect(Object.isFrozen(unknownRegistrationRules.urlSchemes)).toBe(true);
    });

    it("leaves all checks to the registry if the rules are unknown", () => {
        expect(unknownRegistrationRules).toEqual({
            environments: [],
            urlSchemes: ["http", "https"],
        });
    });
});

describe("readRegistrationRules", () => {
    it("reads the registry's service info", async () => {
        const provider = {
            getServiceInfo: async () =>
                ({ registrationRules: { environments: ["qa"] } }) as never,
        };
        expect(await readRegistrationRules(provider)).toEqual({
            ...defaults,
            environments: ["qa"],
        });
    });

    it("is unknown without rules, or if the service info can't be read", async () => {
        expect(
            await readRegistrationRules({
                getServiceInfo: async () => ({ id: "x" }) as never,
            }),
        ).toBeUndefined();
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const provider = {
            getServiceInfo: () => Promise.reject(failure(500)),
        };
        expect(await readRegistrationRules(provider)).toBeUndefined();
        expect(error).toHaveBeenCalledOnce();
        expect(
            await readRegistrationRules(
                { getServiceInfo: () => new Promise<never>(() => {}) },
                { timeout: 1 },
            ),
        ).toBeUndefined();
        expect(String(error.mock.calls[1][1])).toMatch(/timed out/);
        expect(await readRegistrationRules(null)).toBeUndefined();
    });

    it("stops without a log when the caller aborts", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const controller = new AbortController();
        const getServiceInfo = vi.fn(
            ({ signal }: { signal?: AbortSignal } = {}) =>
                new Promise<never>((_, reject) =>
                    signal?.addEventListener("abort", () =>
                        reject(signal.reason),
                    ),
                ),
        );
        const rules = readRegistrationRules(
            { getServiceInfo },
            { signal: controller.signal },
        );
        controller.abort();
        expect(await rules).toBeUndefined();
        expect(getServiceInfo).toHaveBeenCalledWith({
            signal: controller.signal,
        });
        expect(error).not.toHaveBeenCalled();
    });
});

describe("environments", () => {
    const environments = ["qa", "prod"];

    it("allows the listed and empty values", () => {
        expect(isAllowedEnvironment(environments, "qa")).toBe(true);
        expect(isAllowedEnvironment(environments, "test")).toBe(false);
        // case-sensitive, as the registry checks them
        expect(isAllowedEnvironment(environments, "QA")).toBe(false);
        expect(isAllowedEnvironment(environments, "")).toBe(true);
        expect(isAllowedEnvironment(environments, undefined)).toBe(true);
    });

    it("allows any value without a list", () => {
        expect(isAllowedEnvironment([], "anything")).toBe(true);
    });

    it("words the message as the registry does", () => {
        expect(environmentMessage(environments)).toBe(
            "Environment must be one of: 'qa', 'prod'.",
        );
    });

    it("ranks environments in the registry's order, others last", () => {
        expect(environmentRank(environments, "qa")).toBe(0);
        expect(environmentRank(environments, "prod")).toBe(1);
        expect(environmentRank(environments, "other")).toBe(2);
    });
});
