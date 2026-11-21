import { beforeEach, describe, expect, it, vi } from "vitest";

const keyName = "NEXT_PUBLIC_SERVICES_SORT";
const orderName = "NEXT_PUBLIC_SERVICES_SORT_ORDER";

// settings of the test process must not leak into the tests: the module of
// the settings keeps the values it finds when it loads
async function load() {
    vi.resetModules();
    return import("./services-sort");
}

beforeEach(() => {
    vi.stubEnv(keyName, undefined);
    vi.stubEnv(orderName, undefined);
});

describe("servicesSort", () => {
    it("defaults to the name, ascending", async () => {
        const { servicesSort } = await load();
        expect(servicesSort()).toEqual({ key: "name", order: "asc" });
    });

    it("takes blank settings as unset", async () => {
        const { servicesSort } = await load();
        vi.stubEnv(keyName, " ");
        vi.stubEnv(orderName, "");
        expect(servicesSort()).toEqual({ key: "name", order: "asc" });
    });

    it.each(["id", "name", "organization", "type", "environment", "version"])(
        "reads the column %s",
        async (key) => {
            const { servicesSort } = await load();
            vi.stubEnv(keyName, key);
            expect(servicesSort().key).toBe(key);
        },
    );

    it("reads the setting when called, ignoring case and blanks", async () => {
        const { servicesSort } = await load();
        vi.stubEnv(keyName, " Version ");
        vi.stubEnv(orderName, " DESC ");
        expect(servicesSort()).toEqual({ key: "version", order: "desc" });
        vi.stubEnv(orderName, "asc");
        expect(servicesSort()).toEqual({ key: "version", order: "asc" });
    });

    it("falls back to the defaults for invalid values", async () => {
        const { servicesSort } = await load();
        vi.stubEnv(keyName, "url");
        vi.stubEnv(orderName, "up");
        expect(servicesSort()).toEqual({ key: "name", order: "asc" });
    });

    it("keeps a valid value next to an invalid one", async () => {
        const { servicesSort } = await load();
        vi.stubEnv(keyName, "organization");
        vi.stubEnv(orderName, "up");
        expect(servicesSort()).toEqual({ key: "organization", order: "asc" });
    });
});

describe("servicesSortWarnings", () => {
    it.each([
        [undefined, undefined],
        ["", " "],
        ["type", "desc"],
    ])("doesn't warn of %j and %j", async (key, order) => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { servicesSortWarnings } = await load();
        vi.stubEnv(keyName, key);
        vi.stubEnv(orderName, order);
        servicesSortWarnings();
        expect(warn).not.toHaveBeenCalled();
    });

    it("warns of each invalid setting, naming it", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { servicesSortWarnings } = await load();
        vi.stubEnv(keyName, "url");
        vi.stubEnv(orderName, "up");
        servicesSortWarnings();
        expect(warn).toHaveBeenCalledTimes(2);
        expect(warn.mock.calls[0][0]).toMatch(
            /NEXT_PUBLIC_SERVICES_SORT: "url".*id, name, organization, type, environment, version.*name/,
        );
        expect(warn.mock.calls[1][0]).toMatch(
            /NEXT_PUBLIC_SERVICES_SORT_ORDER: "up".*asc or desc.*asc/,
        );
    });
});

describe("sortFromQuery", () => {
    const fallback = { key: "version", order: "desc" } as const;

    it("reads the column and the direction", async () => {
        const { sortFromQuery } = await load();
        expect(
            sortFromQuery(new URLSearchParams("sort=id&order=asc"), fallback),
        ).toEqual({ key: "id", order: "asc" });
    });

    it("falls back to the default for each missing or invalid value", async () => {
        const { sortFromQuery } = await load();
        expect(sortFromQuery(new URLSearchParams(""), fallback)).toEqual(
            fallback,
        );
        expect(
            sortFromQuery(new URLSearchParams("sort=url&order=asc"), fallback),
        ).toEqual({ key: "version", order: "asc" });
        expect(
            sortFromQuery(new URLSearchParams("sort=name&order=up"), fallback),
        ).toEqual({ key: "name", order: "desc" });
    });

    it("ignores the case of values", async () => {
        const { sortFromQuery } = await load();
        expect(
            sortFromQuery(new URLSearchParams("sort=Type&order=ASC"), fallback),
        ).toEqual({ key: "type", order: "asc" });
    });
});

describe("withSortQuery", () => {
    it("sets the column and the direction, keeping other parameters", async () => {
        const { withSortQuery } = await load();
        const url = withSortQuery(
            "https://app.example.org/dashboard/services?x=1&sort=id",
            {
                key: "version",
                order: "desc",
            },
        );
        expect(url.pathname).toBe("/dashboard/services");
        expect(url.searchParams.get("x")).toBe("1");
        expect(url.searchParams.getAll("sort")).toEqual(["version"]);
        expect(url.searchParams.get("order")).toBe("desc");
    });
});

describe("nextSort", () => {
    it("sorts by another column ascending", async () => {
        const { nextSort } = await load();
        expect(nextSort({ key: "name", order: "desc" }, "type")).toEqual({
            key: "type",
            order: "asc",
        });
    });

    it("switches the direction of the same column", async () => {
        const { nextSort } = await load();
        expect(nextSort({ key: "name", order: "asc" }, "name")).toEqual({
            key: "name",
            order: "desc",
        });
        expect(nextSort({ key: "name", order: "desc" }, "name")).toEqual({
            key: "name",
            order: "asc",
        });
    });
});
