import { describe, expect, it } from "vitest";
import { failure } from "@/test/errors";
import {
    maxServicesPerUser,
    servicesLimit,
    servicesLimitMessage,
} from "./service-limits";

describe("maxServicesPerUser", () => {
    it.each([
        [{ registration_rules: { max_services_per_user: 50 } }, 50],
        [{ registration_rules: { max_services_per_user: 0 } }, 0],
        // no limit, or registries without rules
        [{ registration_rules: {} }, undefined],
        [{ registration_rules: { max_services_per_user: -1 } }, undefined],
        [{ registration_rules: { max_services_per_user: 1.5 } }, undefined],
        [{ registration_rules: { max_services_per_user: "5" } }, undefined],
        [{ registration_rules: null }, undefined],
        [{}, undefined],
        [null, undefined],
        ["x", undefined],
    ])("reads %j", (info, limit) => {
        expect(maxServicesPerUser(info)).toBe(limit);
    });
});

describe("servicesLimit", () => {
    it("reads the registry's service info", async () => {
        const provider = {
            getServiceInfo: async () =>
                ({ registration_rules: { max_services_per_user: 3 } }) as never,
        };
        expect(await servicesLimit(provider)).toBe(3);
    });

    it("is unknown if the service info can't be read", async () => {
        const provider = {
            getServiceInfo: () => Promise.reject(failure(500)),
        };
        expect(await servicesLimit(provider)).toBeUndefined();
        expect(await servicesLimit(null)).toBeUndefined();
    });
});

describe("servicesLimitMessage", () => {
    it("names the limit", () => {
        expect(servicesLimitMessage(50)).toBe(
            "You have registered as many services as this registry allows (50). Delete services you no longer need, or ask an admin.",
        );
    });

    it("points admins to admin mode", () => {
        expect(servicesLimitMessage(50, true)).toBe(
            "You have registered as many services as this registry allows (50). Delete services you no longer need, or ask an admin. As an admin, you can also register it in admin mode.",
        );
        expect(servicesLimitMessage(0, true)).toBe(
            "Only admins can register services in this registry. Please ask an admin. As an admin, you can also register it in admin mode.",
        );
    });

    it("says when only admins register services", () => {
        expect(servicesLimitMessage(0)).toBe(
            "Only admins can register services in this registry. Please ask an admin.",
        );
    });
});
