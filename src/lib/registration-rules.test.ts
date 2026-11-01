import { describe, expect, it } from "vitest";
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
                registration_rules: {
                    environments: ["qa", "prod"],
                    url_schemes: ["http", "https"],
                    service_types: "moderated",
                    max_unused_service_types: 10,
                    max_services_per_user: 0,
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

    it("keeps an empty list of environments, for any value", () => {
        expect(
            registrationRules({ registration_rules: { environments: [] } })
                ?.environments,
        ).toEqual([]);
    });

    it("drops duplicate and empty environments and unknown schemes", () => {
        expect(
            registrationRules({
                registration_rules: {
                    environments: ["prod", "", "prod", ",", "test"],
                    url_schemes: ["HTTPS", "ftp", "https"],
                },
            }),
        ).toMatchObject({
            environments: ["prod", "test"],
            urlSchemes: ["https"],
        });
    });

    it.each([
        [{}],
        [{ registration_rules: null }],
        [{ registration_rules: "x" }],
        [null],
        ["x"],
    ])("has no rules for %j", (info) => {
        // registries older than cloud-registry 0.6.0
        expect(registrationRules(info)).toBeUndefined();
    });

    it.each([
        [{ registration_rules: {} }],
        [
            {
                registration_rules: {
                    environments: ["prod", 1],
                    url_schemes: ["ftp"],
                    service_types: "closed",
                    max_unused_service_types: -1,
                    max_services_per_user: 1.5,
                },
            },
        ],
        [
            {
                registration_rules: {
                    environments: "prod",
                    url_schemes: [],
                    max_unused_service_types: "5",
                    max_services_per_user: null,
                },
            },
        ],
    ])("falls back to the defaults for %j", (info) => {
        expect(registrationRules(info)).toEqual(defaults);
    });

    it("doesn't share the defaults' lists, which can't change", () => {
        const rules = registrationRules({ registration_rules: {} });
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
                ({ registration_rules: { environments: ["qa"] } }) as never,
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
        const provider = {
            getServiceInfo: () => Promise.reject(failure(500)),
        };
        expect(await readRegistrationRules(provider)).toBeUndefined();
        expect(await readRegistrationRules(null)).toBeUndefined();
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
