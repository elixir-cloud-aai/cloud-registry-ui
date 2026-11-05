import { describe, expect, it } from "vitest";
import {
    defaultRegistrationRules,
    type RegistrationRules,
} from "@/lib/registration-rules";
import { registrationRuleRows } from "./rules-helper";

/** The rows as an object, by label */
const rows = (rules: RegistrationRules) =>
    Object.fromEntries(
        registrationRuleRows(rules).map(({ label, value }) => [label, value]),
    );

describe("registrationRuleRows", () => {
    it("shows the rules in the order of the registry's docs", () => {
        expect(
            registrationRuleRows({
                environments: ["prod", "test"],
                urlSchemes: ["https", "http"],
                serviceTypes: "open",
                maxUnusedServiceTypes: 10,
                maxServicesPerUser: 50,
            }),
        ).toEqual([
            { label: "Environments", value: "prod, test" },
            { label: "URL schemes", value: "https, http" },
            { label: "Who may add service types", value: "Logged-in users" },
            { label: "Unused service types per user", value: "10" },
            { label: "Services per user", value: "50" },
        ]);
    });

    it("says whether and how often the registry syncs", () => {
        expect(
            rows({
                ...defaultRegistrationRules,
                serviceInfoSync: { enabled: true, intervalHours: 6 },
            }),
        ).toMatchObject({ "Sync with service info": "Every 6 hours" });
        expect(
            rows({
                ...defaultRegistrationRules,
                serviceInfoSync: { enabled: false, intervalHours: 24 },
            }),
        ).toMatchObject({ "Sync with service info": "Off" });
    });

    it("explains missing limits, 0 and any environment", () => {
        expect(rows({ ...defaultRegistrationRules, environments: [] })).toEqual(
            {
                Environments: "Any",
                "URL schemes": "https",
                "Who may add service types": "Not published",
                "Unused service types per user": "No limit",
                "Services per user": "No limit",
            },
        );
        expect(
            rows({
                ...defaultRegistrationRules,
                maxUnusedServiceTypes: 0,
                maxServicesPerUser: 0,
            }),
        ).toMatchObject({
            "Unused service types per user":
                "None: only admins add service types",
            "Services per user": "None: only admins register services",
        });
    });

    it.each([
        ["open", 0, "Admins only"],
        ["moderated", 0, "Admins only"],
        ["controlled", 0, "Admins only"],
        ["controlled", undefined, "Admins only"],
        ["moderated", 5, "pending until an admin approves them"],
        ["open", undefined, "Logged-in users"],
    ] as const)(
        "says who may add types in mode %s with limit %s",
        (serviceTypes, maxUnusedServiceTypes, text) => {
            expect(
                rows({
                    ...defaultRegistrationRules,
                    serviceTypes,
                    maxUnusedServiceTypes,
                })["Who may add service types"],
            ).toContain(text);
        },
    );
});
