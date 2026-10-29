import { describe, expect, it } from "vitest";
import { failure } from "@/test/errors";
import {
    isServicesLimit,
    maxServicesPerUser,
    servicesLimitMessage,
} from "./service-limits";

describe("isServicesLimit", () => {
    it("tells the limit apart by its code", () => {
        expect(isServicesLimit(failure(409, { code: "services-limit" }))).toBe(
            true,
        );
        expect(
            isServicesLimit(failure(409, { code: "duplicate-service" })),
        ).toBe(false);
        // registries with the limit send codes
        expect(isServicesLimit(failure(409))).toBe(false);
        expect(isServicesLimit(failure(400, { code: "services-limit" }))).toBe(
            false,
        );
    });
});

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

describe("servicesLimitMessage", () => {
    it("names the limit, if known", () => {
        expect(servicesLimitMessage(50)).toBe(
            "You have registered as many services as this registry allows (50). Delete services you no longer need, or ask an admin.",
        );
        expect(servicesLimitMessage(undefined)).toBe(
            "You have registered as many services as this registry allows. Delete services you no longer need, or ask an admin.",
        );
    });

    it("says when only admins register services", () => {
        expect(servicesLimitMessage(0)).toBe(
            "Only admins can register services in this registry. Please ask an admin.",
        );
    });
});
