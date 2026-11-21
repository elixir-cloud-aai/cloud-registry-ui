import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { describe, expect, it } from "vitest";
import { sortServices } from "./sort-helper";

const service = (
    id: string,
    fields: Partial<ExternalService> = {},
): ExternalService =>
    ({
        id,
        name: `Service ${id}`,
        url: `https://${id}.example.org`,
        type: { group: "org.ga4gh", artifact: "tes", version: "1.1.0" },
        version: "1.0.0",
        organization: { name: "Org A", url: "https://a.example.org" },
        ...fields,
    }) as ExternalService;

const ids = (services: ExternalService[]) => services.map((val) => val.id);

describe("sortServices", () => {
    it("sorts by name, ignoring case and accents", () => {
        const services = [
            service("1", { name: "beta" }),
            service("2", { name: "Alpha" }),
            service("3", { name: "Émile" }),
            service("4", { name: "delta" }),
        ];
        expect(
            ids(sortServices(services, { key: "name", order: "asc" })),
        ).toEqual(["2", "1", "4", "3"]);
        expect(
            ids(sortServices(services, { key: "name", order: "desc" })),
        ).toEqual(["3", "4", "1", "2"]);
    });

    it("leaves the given list as it is", () => {
        const services = [service("b"), service("a")];
        sortServices(services, { key: "id", order: "asc" });
        expect(ids(services)).toEqual(["b", "a"]);
    });

    it("sorts versions by their numbers", () => {
        const services = [
            service("a", { version: "1.10.0" }),
            service("b", { version: "1.9.0" }),
            service("c", { version: "1.9.1" }),
            service("d", { version: "2.0.0" }),
        ];
        expect(
            ids(sortServices(services, { key: "version", order: "asc" })),
        ).toEqual(["b", "c", "a", "d"]);
        expect(
            ids(sortServices(services, { key: "version", order: "desc" })),
        ).toEqual(["d", "a", "c", "b"]);
    });

    it("sorts IDs by their numbers", () => {
        const services = [
            service("svc-10"),
            service("svc-9"),
            service("svc-1"),
        ];
        expect(
            ids(sortServices(services, { key: "id", order: "asc" })),
        ).toEqual(["svc-1", "svc-9", "svc-10"]);
    });

    it("sorts types by artifact, then version, then group", () => {
        const type = (group: string, artifact: string, version: string) => ({
            type: { group, artifact, version },
        });
        const services = [
            service("a", type("org.ga4gh", "wes", "1.0.0")),
            service("b", type("org.ga4gh", "tes", "1.10.0")),
            service("c", type("org.ga4gh", "tes", "1.9.0")),
            service("d", type("org.example", "tes", "1.9.0")),
            service("e", type("org.ga4gh", "drs", "1.5.0")),
        ];
        expect(
            ids(sortServices(services, { key: "type", order: "asc" })),
        ).toEqual(["e", "d", "c", "b", "a"]);
        expect(
            ids(sortServices(services, { key: "type", order: "desc" })),
        ).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("sorts by organization and environment", () => {
        const org = (name: string) => ({
            organization: { name, url: "https://example.org" },
        });
        const services = [
            service("a", { ...org("Org B"), environment: "test" }),
            service("b", { ...org("org a"), environment: "prod" }),
            service("c", { ...org("Org C"), environment: "dev" }),
        ];
        expect(
            ids(sortServices(services, { key: "organization", order: "asc" })),
        ).toEqual(["b", "a", "c"]);
        expect(
            ids(sortServices(services, { key: "environment", order: "asc" })),
        ).toEqual(["c", "b", "a"]);
    });

    it("lists services without a value last, in both directions", () => {
        const services = [
            service("a", { environment: undefined }),
            service("b", { environment: "prod" }),
            service("c", { environment: "" }),
            service("d", { environment: "dev" }),
        ];
        expect(
            ids(sortServices(services, { key: "environment", order: "asc" })),
        ).toEqual(["d", "b", "a", "c"]);
        expect(
            ids(sortServices(services, { key: "environment", order: "desc" })),
        ).toEqual(["b", "d", "a", "c"]);
    });

    it("breaks ties by name, then by ID, in both directions", () => {
        const services = [
            service("c", { name: "Same", version: "1.0.0" }),
            service("b", { name: "Other", version: "1.0.0" }),
            service("a", { name: "same", version: "1.0.0" }),
            service("d", { name: "First", version: "2.0.0" }),
        ];
        expect(
            ids(sortServices(services, { key: "version", order: "asc" })),
        ).toEqual(["b", "a", "c", "d"]);
        expect(
            ids(sortServices(services, { key: "version", order: "desc" })),
        ).toEqual(["d", "b", "a", "c"]);
    });

    it("orders IDs that differ only in case", () => {
        const services = [
            service("B", { name: "Same" }),
            service("b", { name: "Same" }),
        ];
        expect(
            ids(sortServices(services, { key: "name", order: "asc" })),
        ).toEqual(["B", "b"]);
        expect(
            ids(
                sortServices(services.toReversed(), {
                    key: "name",
                    order: "asc",
                }),
            ),
        ).toEqual(["B", "b"]);
    });

    it("keeps services with the same ID", () => {
        const services = [
            service("a", { url: "https://1.example.org" }),
            service("a", { url: "https://2.example.org" }),
        ];
        expect(
            sortServices(services, { key: "id", order: "asc" }).map(
                (val) => val.url,
            ),
        ).toEqual(["https://1.example.org", "https://2.example.org"]);
    });
});
