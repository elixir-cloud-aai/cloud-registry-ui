import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { describe, expect, it } from "vitest";
import type { Me, ServiceVerification } from "@/lib/cloud-registry.types";
import { typeKey } from "@/lib/service-types";
import {
    defaultFilters,
    filterOptions,
    filterServices,
    isFiltered,
    myServices,
} from "./filter-helper";

const tes = { group: "org.ga4gh", artifact: "tes", version: "1.1.0" };
const wes = { group: "org.ga4gh", artifact: "wes", version: "1.0.0" };
const service = (
    id: string,
    fields: Partial<ExternalService> = {},
): ExternalService =>
    ({
        id,
        name: `Service ${id}`,
        url: `https://${id}.example.org`,
        type: tes,
        version: "1.0.0",
        organization: { name: "Org A", url: "https://a.example.org" },
        ...fields,
    }) as ExternalService;

const services = [
    service("a", { environment: "test", description: "Funnel on Kubernetes" }),
    service("b", {
        type: wes,
        environment: "prod",
        organization: { name: "Org B", url: "https://b.example.org" },
    }),
    service("c", { environment: "custom" }),
    service("d", { organization: { name: "", url: "https://d.example.org" } }),
];
const none = new Map<string, ServiceVerification>();

describe("filterOptions", () => {
    it("lists each value once, sorted, missing ones last", () => {
        expect(filterOptions(services, "organization")).toEqual([
            "Org A",
            "Org B",
            null,
        ]);
        expect(filterOptions(services, "type")).toEqual([
            typeKey(tes),
            typeKey(wes),
        ]);
    });

    it("lists the registry's environments first, in its order", () => {
        const all = [...services, service("e", { environment: "alpha" })];
        expect(
            filterOptions(all, "environment", ["prod", "test", "dev"]),
        ).toEqual(["prod", "test", "alpha", "custom", null]);
        expect(filterOptions(all, "environment", ["custom", "prod"])).toEqual([
            "custom",
            "prod",
            "alpha",
            "test",
            null,
        ]);
        // without a list, e.g. if any value is allowed: alphabetically
        expect(filterOptions(all, "environment")).toEqual([
            "alpha",
            "custom",
            "prod",
            "test",
            null,
        ]);
    });

    it("sorts missing values last wherever they are", () => {
        expect(filterOptions([...services].reverse(), "organization")).toEqual([
            "Org A",
            "Org B",
            null,
        ]);
    });
});

describe("isFiltered", () => {
    it("tells whether a search or filter is set", () => {
        expect(isFiltered(" ", defaultFilters)).toBe(false);
        expect(isFiltered("x", {})).toBe(true);
        expect(isFiltered("", { organization: null })).toBe(true);
        expect(isFiltered("", { verified: true })).toBe(true);
        expect(isFiltered("", { pending: true })).toBe(true);
        expect(isFiltered("", { mine: true })).toBe(true);
        expect(
            isFiltered("", { verified: false, pending: false, mine: false }),
        ).toBe(false);
    });
});

describe("filterServices", () => {
    const ids = (list: ExternalService[]) => list.map((val) => val.id);
    const run = (
        search: string,
        filters = {},
        verified = none,
        pending = new Set<string>(),
        mine = new Set<string>(),
    ) =>
        ids(
            filterServices(services, search, filters, {
                verifications: verified,
                pending,
                mine,
            }),
        );

    it("searches the main fields, ignoring case", () => {
        expect(run(" kubernetes ")).toEqual(["a"]);
        expect(run("WES")).toEqual(["b"]);
        expect(run("org b")).toEqual(["b"]);
        expect(run("c.example")).toEqual(["c"]);
        expect(run("")).toEqual(["a", "b", "c", "d"]);
    });

    it("filters by values, also missing ones", () => {
        expect(run("", { type: typeKey(wes) })).toEqual(["b"]);
        expect(run("", { environment: "test" })).toEqual(["a"]);
        expect(run("", { organization: null })).toEqual(["d"]);
        expect(run("", { environment: null })).toEqual(["d"]);
    });

    it("filters verified and pending services", () => {
        const verified = new Map([["b", {} as ServiceVerification]]);
        expect(run("", { verified: true }, verified)).toEqual(["b"]);
        expect(run("", { pending: true }, none, new Set(["c"]))).toEqual(["c"]);
        expect(
            run(
                "",
                { verified: true, pending: true },
                verified,
                new Set(["c"]),
            ),
        ).toEqual([]);
    });

    it("filters the user's services, with the other filters", () => {
        const mine = new Set(["a", "b"]);
        expect(run("", { mine: true }, none, new Set(), mine)).toEqual([
            "a",
            "b",
        ]);
        expect(
            run("", { mine: true, type: typeKey(wes) }, none, new Set(), mine),
        ).toEqual(["b"]);
        expect(
            run("kubernetes", { mine: true }, none, new Set(), mine),
        ).toEqual(["a"]);
        // without roles, or without the filter
        expect(run("", { mine: true })).toEqual([]);
        expect(run("", {}, none, new Set(), mine)).toEqual([
            "a",
            "b",
            "c",
            "d",
        ]);
    });
});

describe("myServices", () => {
    const me = (services: Me["services"]) => ({ services });

    it("lists the services with a role, direct or through a group", () => {
        expect(
            myServices(
                me([
                    { serviceId: "a", role: "owner" },
                    { serviceId: "a", role: "maintainer", group: "team" },
                    { serviceId: "c", role: "maintainer", group: "team" },
                ]),
            ),
        ).toEqual(new Set(["a", "c"]));
    });

    it("lists none without a user", () => {
        expect(myServices(null)).toEqual(new Set());
        expect(myServices(me([]))).toEqual(new Set());
    });
});
