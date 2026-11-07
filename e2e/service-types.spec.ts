import type { Page, Request } from "@playwright/test";
import {
    api,
    editFormReads,
    expect,
    isApprovalsRead,
    isRead,
    login,
    newService,
    openList,
    openPage,
    registerService,
    registry,
    test,
    tokenOf,
    uniqueId,
    waitForReads,
} from "./fixtures";

// the note of the edit form (`updation-form.tsx`) on new types
const pendingNote =
    "A service type that isn't registered yet is pending until an admin approves it";

/**
 * Get the select of the type in a service's edit form
 * @param page Page with the form
 * @returns The select
 */
function typeSelect(page: Page) {
    return page.getByRole("combobox", { name: "Service Type" });
}

/**
 * Open the list of types in a service's edit form, once the form's reads
 * have finished
 * @param page Page, logged in
 * @param id ID of the service
 */
async function openTypeList(page: Page, id: string) {
    await openPage(page, `/dashboard/services/update/${id}`, editFormReads(id));
    await openList(typeSelect(page));
}

// the page may still read through a test's routes when the test ends, e.g.
// the service info, which it reads more than once: their fetches would fail
// on the closed page
test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
});

test.describe("pending entries", () => {
    /**
     * Keep the page's reads of the pending entries
     * @param page Page
     * @returns The list of requests, which grows while the page runs
     */
    function watchApprovals(page: Page) {
        const reads: Request[] = [];
        page.on("request", (request) => {
            if (
                request.method() === "GET" &&
                request.url() === `${registry}/approvals`
            )
                reads.push(request);
        });
        return reads;
    }

    test("are read with the token only", async ({ page }) => {
        const reads = watchApprovals(page);
        await login(page, "admin", { adminMode: true });
        await openPage(page, "/dashboard/services", [isApprovalsRead]);
        // checks the requests, as `expectedMessage` allows the probe's 401
        for (const read of reads)
            expect(read.headers().authorization).toBeTruthy();
    });

    test("are read from registries that publish no rules", async ({ page }) => {
        await page.route(`${registry}/service-info`, async (route) => {
            const response = await route.fetch();
            const { registrationRules: _, ...info } = await response.json();
            await route.fulfill({ response, json: info });
        });
        const reads = watchApprovals(page);
        await login(page, "admin", { adminMode: true });
        await page.goto("/dashboard/services");
        // the probe without a token, then the read with it
        await expect
            .poll(() => reads.map((read) => !!read.headers().authorization))
            .toEqual(expect.arrayContaining([false, true]));
    });
});

test.describe("service types", () => {
    test("new types of users are pending until an admin approves them", async ({
        page,
        browser,
    }) => {
        const owner = await tokenOf(browser, "owner");
        const type = {
            group: "org.example",
            artifact: `e2e-${uniqueId()}`,
            version: "1.0.0",
        };
        const service = { ...newService("Awaiting"), type };
        expect((await api(owner, "POST", "/services/types", type)).status).toBe(
            201,
        );
        const created = await api(owner, "POST", "/services", service);
        expect(created.status).toBe(201);
        // hidden from the public reads while pending
        expect(
            (await api(undefined, "GET", `/services/${created.body}`)).status,
        ).toBe(404);

        await login(page, "admin", { adminMode: true });
        await page.goto(`/dashboard/services/view/${created.body}`);
        await expect(page.getByText("Pending", { exact: true })).toBeVisible();
        await expect(
            page
                .getByRole("status")
                .filter({ hasText: "awaits the approval of its service type" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Approve" }).click();
        await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Approve" })
            .click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${created.body}`))
                        .status,
            )
            .toBe(200);
    });

    test("the edit form offers the registered types", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Typed");
        // admins' types are approved at once
        const other = {
            group: "org.example",
            artifact: `e2e-${uniqueId()}`,
            version: "1.0.0",
        };
        expect(
            (
                await api(
                    await tokenOf(browser, "admin"),
                    "POST",
                    "/services/types",
                    other,
                )
            ).status,
        ).toBe(201);
        await login(page, "owner");

        await openTypeList(page, service.id);
        await expect(
            page.getByRole("option", { name: "Add new service type" }),
        ).toBeVisible();
        // no fields to type into until a new type is asked for
        await expect(
            page.getByRole("textbox", { name: "Type Artifact" }),
        ).toHaveCount(0);
        await page
            .getByRole("option", { name: "Add new service type" })
            .click();
        await expect(
            page.getByRole("textbox", { name: "Type Group" }),
        ).toHaveValue("org.ga4gh");
        await page
            .getByRole("textbox", { name: "Type Artifact" })
            .fill(`e2e-${uniqueId()}`);
        // new types of users are pending in the registry of the tests
        await expect(page.getByText(pendingNote)).toBeVisible();

        await openList(typeSelect(page));
        const label = `${other.group} · ${other.artifact} · ${other.version}`;
        await page.getByRole("option", { name: label }).click();
        await expect(
            page.getByRole("textbox", { name: "Type Artifact" }),
        ).toHaveCount(0);
        await expect(page.getByText(pendingNote)).toHaveCount(0);
        await page.getByRole("button", { name: "Submit" }).click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .body?.type,
            )
            .toEqual(other);
    });

    test("users who may not add types choose a registered one", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Listed");
        await page.route(`${registry}/me`, async (route) => {
            const response = await route.fetch();
            const me = await response.json();
            await route.fulfill({
                response,
                json: { ...me, mayAddServiceTypes: false },
            });
        });
        await login(page, "owner");

        await openTypeList(page, service.id);
        await expect(
            page.getByRole("option", { name: "org.ga4gh · tes · 1.1.0" }),
        ).toBeVisible();
        await expect(
            page.getByRole("option", { name: "Add new service type" }),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");
    });

    test("pending services keep their type, and take no new one", async ({
        page,
        browser,
    }) => {
        const owner = await tokenOf(browser, "owner");
        const type = {
            group: "org.example",
            artifact: `e2e-${uniqueId()}`,
            version: "1.0.0",
        };
        const created = await api(owner, "POST", "/services", {
            ...newService("Pending type"),
            type,
        });
        expect(created.status).toBe(201);
        await login(page, "owner");

        await openTypeList(page, created.body);
        // listed only for the service, as GET /services/types doesn't list
        // pending types to the app
        const label = `${type.group} · ${type.artifact} · ${type.version}`;
        await expect(
            page.getByRole("option", { name: label, selected: true }),
        ).toBeVisible();
        await expect(
            page.getByRole("option", { name: "Add new service type" }),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");
    });

    test("without the registered types, the edit form keeps the stored one", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "No types");
        await page.route(`${registry}/services/types`, (route) =>
            route.fulfill({ status: 503, body: "" }),
        );
        await login(page, "owner");

        await openTypeList(page, service.id);
        await expect(
            page.getByRole("option", {
                name: "org.ga4gh · tes · 1.1.0",
                selected: true,
            }),
        ).toBeVisible();
        await expect(
            page.getByRole("option", { name: "Add new service type" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(
            page.getByText("Could not load the registered service types."),
        ).toBeVisible();

        const renamed = `${service.name} renamed`;
        await page.locator("input[name=name]").fill(renamed);
        // the form reads the service again, whose problems would come
        // after the check
        await waitForReads(
            page,
            () => page.getByRole("button", { name: "Submit" }).click(),
            [isRead(`/services/${service.id}`)],
        );
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .body?.name,
            )
            .toBe(renamed);
        // the failed reads of the types, which the page reports
        expect(
            problems.filter(
                (val) =>
                    !val.includes(`${registry}/services/types`) &&
                    !val.includes("Failed to load the service types"),
            ),
        ).toEqual([]);
        problems.length = 0;
    });

    test("users save a new type, which is pending; Reset goes back to the list", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "New type");
        await login(page, "owner");

        await openTypeList(page, service.id);
        await page
            .getByRole("option", { name: "Add new service type" })
            .click();
        await page.getByRole("button", { name: "Reset" }).click();
        await expect(
            page.getByRole("textbox", { name: "Type Artifact" }),
        ).toHaveCount(0);
        await expect(
            page.getByRole("combobox", { name: "Service Type" }),
        ).toHaveText("org.ga4gh · tes · 1.1.0");

        await openList(typeSelect(page));
        await page
            .getByRole("option", { name: "Add new service type" })
            .click();
        const artifact = `e2e-${uniqueId()}`;
        await page
            .getByRole("textbox", { name: "Type Artifact" })
            .fill(artifact);
        await page.getByRole("textbox", { name: "Type Version" }).fill("1.0.0");
        await page.getByRole("button", { name: "Submit" }).click();
        // the service is pending with its new type: hidden from the public
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .status,
            )
            .toBe(404);
        const approvals = await api(
            await tokenOf(browser, "owner"),
            "GET",
            "/approvals",
        );
        expect(approvals.body.serviceTypes).toContainEqual({
            group: "org.ga4gh",
            artifact,
            version: "1.0.0",
        });
    });

    test("long lists of types keep the new type in view", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Long list");
        // types before the service's own, which the list shows first
        await page.route(`${registry}/services/types`, async (route) => {
            const response = await route.fetch();
            const more = Array.from({ length: 100 }, (_, idx) => ({
                group: "org.example",
                artifact: `long-${String(idx).padStart(3, "0")}`,
                version: "1.0.0",
            }));
            await route.fulfill({
                response,
                json: [...(await response.json()), ...more],
            });
        });
        await login(page, "owner");

        await openTypeList(page, service.id);
        await expect(
            page.getByRole("option", { name: "Add new service type" }),
        ).toBeInViewport({ ratio: 1 });
        await page.keyboard.press("Escape");
    });

    test("the user's own pending types aren't offered", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Own type");
        const owner = await tokenOf(browser, "owner");
        const pendingType = {
            group: "org.example",
            artifact: `e2e-${uniqueId()}`,
            version: "1.0.0",
        };
        expect(
            (await api(owner, "POST", "/services/types", pendingType)).status,
        ).toBe(201);
        // as registries that require login for reads list them, to the
        // users who added them
        await page.route(`${registry}/services/types`, async (route) => {
            const response = await route.fetch();
            await route.fulfill({
                response,
                json: [...(await response.json()), pendingType],
            });
        });
        await login(page, "owner");

        await openTypeList(page, service.id);
        await expect(
            page.getByRole("option", { name: "org.ga4gh · tes · 1.1.0" }),
        ).toBeVisible();
        await expect(
            page.getByRole("option", {
                name: `${pendingType.group} · ${pendingType.artifact} · ${pendingType.version}`,
            }),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");
    });

    test("the tiles show group, artifact and version line by line", async ({
        page,
    }) => {
        const type = {
            group: "org.example.with.a.rather.long.group",
            artifact: "e2e-artifact-with-a-rather-long-name",
            version: "2.0.0",
        };
        await page.route(`${registry}/services/types`, (route) =>
            route.fulfill({ json: [type] }),
        );
        await page.goto("/dashboard/service-types");

        // the joined type names the tile
        await expect(
            page.getByRole("group", {
                name: `${type.group} · ${type.artifact} · ${type.version}`,
            }),
        ).toBeVisible();
        await expect(page.getByRole("term")).toHaveText([
            "Group:",
            "Artifact:",
            "Version:",
        ]);
        const values = page.getByRole("definition");
        await expect(values).toHaveText([
            type.group,
            type.artifact,
            type.version,
        ]);
        // short values stay on one line, e.g. the version doesn't wrap as
        // "2.0." and "0"
        // (the label "Version:" is one line; terms and values are as high
        // as their text)
        const term = await page.getByRole("term").last().boundingBox();
        const version = await values.last().boundingBox();
        expect(version?.height).toBeLessThan((term?.height ?? 0) * 1.5);
    });
});
