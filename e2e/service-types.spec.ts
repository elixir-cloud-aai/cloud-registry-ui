import type { Page } from "@playwright/test";
import {
    api,
    expect,
    login,
    newService,
    registerService,
    registry,
    test,
    tokenOf,
    uniqueId,
} from "./fixtures";

const pendingNote =
    "A service type that isn't registered yet is pending until an admin approves it";

/**
 * Open the list of types in a service's edit form
 * @param page Page
 * @param id ID of the service
 */
async function openTypeList(page: Page, id: string) {
    await page.goto(`/dashboard/services/update/${id}`);
    await page.getByRole("combobox", { name: "Service Type" }).click();
}

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

        await page.getByRole("combobox", { name: "Service Type" }).click();
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
        await page.waitForLoadState("networkidle");
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
                json: { ...me, may_add_service_types: false },
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
        await page.waitForLoadState("networkidle");
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
        await page.waitForLoadState("networkidle");
    });
});
