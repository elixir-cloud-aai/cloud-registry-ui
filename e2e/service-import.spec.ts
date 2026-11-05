import type { Page } from "@playwright/test";
import {
    addTesType,
    api,
    changeServiceInfo,
    expect,
    fillCreateForm,
    login,
    newService,
    openCreateForm,
    publishRules,
    registry,
    serviceWithInfo,
    test,
} from "./fixtures";

const syncBox = /Keep this service in sync with its service info/;

/**
 * Import service info in the create form
 * @param page Page with the form
 * @param address Address of the service-info endpoint
 */
async function importInto(page: Page, address: string) {
    await page.getByLabel("Import from service info").fill(address);
    await page.getByRole("button", { name: "Import", exact: true }).click();
}

/**
 * Get a field of the create form
 * @param page Page with the form
 * @param name Its placeholder
 * @returns The field
 */
function field(page: Page, name: string) {
    return page.getByRole("textbox", { name, exact: true });
}

/**
 * Get the ID of the only service with a name
 * @param token Access token
 * @param name The name
 * @returns The ID, once the service is listed
 */
async function idOf(token: string, name: string) {
    let id: string | undefined;
    await expect
        .poll(async () => {
            const services = await api(token, "GET", "/services");
            id = services.body.find(
                (val: { name: string }) => val.name === name,
            )?.id;
            return id;
        })
        .toBeTruthy();
    return id as string;
}

test.describe("importing service info", () => {
    // remove the routes of `publishRules()`, which the page may still use
    // when a test ends
    test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    test("the form takes the values, and the service is synced", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const form = await openCreateForm(page);
        const service = serviceWithInfo();

        // recommended, and limited to public service info
        await expect(form.getByText("Recommended")).toBeVisible();
        await expect(
            form.getByText(
                "Only publicly available service info can be imported: no tokens are sent.",
            ),
        ).toBeVisible();
        // manual entries don't sync
        const box = form.getByRole("checkbox", { name: syncBox });
        await expect(box).toBeDisabled();
        await expect(box).not.toBeChecked();
        await expect(box).toHaveAccessibleName(/every day/);

        await importInto(page, service.address);

        await expect(
            field(page, "Enter a descriptive name for your service"),
        ).toHaveValue(service.name);
        await expect(field(page, "https://api.example.com/v1")).toHaveValue(
            service.url,
        );
        await expect(field(page, "Enter your organization name")).toHaveValue(
            "E2E Org",
        );
        // the form shows the registered type as chosen
        await expect(
            form.getByRole("button", { name: "org.ga4gh · tes · 1.1.0" }),
        ).toBeVisible();
        await expect(box).toBeEnabled();
        await expect(box).toBeChecked();

        await page.getByRole("button", { name: "Create Service" }).click();

        await expect(
            page.getByText(`Registered ${service.name}`),
        ).toBeVisible();
        await expect(form).toBeHidden();
        await expect(page.getByText("Sync is on")).toBeVisible();
        const id = await idOf(token, service.name);
        const sync = await api(token, "GET", `/services/${id}/sync`);
        expect(sync.status).toBe(200);
        expect(sync.body.status).toBe("synced");
    });

    test("users may leave a new service out of sync", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const form = await openCreateForm(page);
        const service = serviceWithInfo();

        await importInto(page, service.address);
        const box = form.getByRole("checkbox", { name: syncBox });
        await expect(box).toBeChecked();
        await box.click();
        await expect(box).not.toBeChecked();
        await page.getByRole("button", { name: "Create Service" }).click();

        await expect(form).toBeHidden();
        const id = await idOf(token, service.name);
        const sync = await api(token, "GET", `/services/${id}/sync`);
        expect(sync.status).toBe(404);
    });

    test("changing imported values turns sync off, with a warning", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const form = await openCreateForm(page);
        const service = serviceWithInfo();
        const syncs: string[] = [];
        page.on("request", (request) => {
            if (request.url().endsWith("/sync")) syncs.push(request.url());
        });

        await importInto(page, service.address);
        const box = form.getByRole("checkbox", { name: syncBox });
        await expect(box).toBeChecked();
        const warning = form.getByText("syncing would override these changes");
        await expect(warning).toBeHidden();

        // the values stay editable
        const name = field(page, "Enter a descriptive name for your service");
        await name.fill(`${service.name} changed`);
        await expect(box).toBeDisabled();
        await expect(box).not.toBeChecked();
        await expect(warning).toBeVisible();

        // changing them back brings it back
        await name.fill(service.name);
        await expect(box).toBeEnabled();
        await expect(box).toBeChecked();
        await expect(warning).toBeHidden();

        await name.fill(`${service.name} changed`);
        await page.getByRole("button", { name: "Create Service" }).click();
        await expect(form).toBeHidden();
        expect(syncs).toEqual([]);
        const id = await idOf(token, `${service.name} changed`);
        expect((await api(token, "GET", `/services/${id}/sync`)).status).toBe(
            404,
        );
    });

    test("changes during an import stay", async ({ page, browser }) => {
        await addTesType(browser);
        await login(page, "owner");
        await openCreateForm(page);
        await page.route(`${registry}/services/import`, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await route.fallback();
        });
        await importInto(page, serviceWithInfo().address);
        await expect(
            page.getByLabel("Import from service info"),
        ).toBeDisabled();
        await field(page, "Enter a descriptive name for your service").fill(
            "Typed meanwhile",
        );
        await expect(page.getByText("The form changed")).toBeVisible();
        await expect(
            field(page, "Enter a descriptive name for your service"),
        ).toHaveValue("Typed meanwhile");
    });

    test("Reset ends the import", async ({ page, browser }) => {
        await addTesType(browser);
        await login(page, "owner");
        const form = await openCreateForm(page);

        await importInto(page, serviceWithInfo().address);
        const box = form.getByRole("checkbox", { name: syncBox });
        await expect(box).toBeChecked();
        await page.getByRole("button", { name: "Reset" }).click();
        await expect(
            field(page, "Enter a descriptive name for your service"),
        ).toHaveValue("");
        await expect(box).toBeDisabled();
        await expect(box).not.toBeChecked();
        await expect(
            form.getByText("syncing would override these changes"),
        ).toBeHidden();
    });

    test("a manual entry registers without a sync", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const form = await openCreateForm(page);
        const service = newService("Manual");
        await fillCreateForm(page, service);
        await expect(
            form.getByRole("checkbox", { name: syncBox }),
        ).toBeDisabled();
        await page.getByRole("button", { name: "Create Service" }).click();
        await expect(form).toBeHidden();
        const id = await idOf(token, service.name);
        expect((await api(token, "GET", `/services/${id}/sync`)).status).toBe(
            404,
        );
    });

    test("a failed first fetch keeps the service, and says so", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const form = await openCreateForm(page);
        const service = serviceWithInfo();

        await importInto(page, service.address);
        await expect(
            form.getByRole("checkbox", { name: syncBox }),
        ).toBeChecked();
        // the service goes down between the import and the registration
        await changeServiceInfo(service.key, { status: 503 });
        await page.getByRole("button", { name: "Create Service" }).click();

        await expect(form).toBeHidden();
        await expect(
            page.getByText(`Registered ${service.name}`),
        ).toBeVisible();
        await expect(
            page.getByText("The service is registered, but sync is off."),
        ).toBeVisible();
        await expect(
            page.getByText("The registry could not fetch the service info."),
        ).toBeVisible();
        const id = await idOf(token, service.name);
        expect((await api(token, "GET", `/services/${id}/sync`)).status).toBe(
            404,
        );
        // the 502 of the sync, which the app handles
        const expected = problems.splice(0);
        expect(expected.every((val) => val.includes("/sync"))).toBe(true);
    });

    test("a failed import says why, and keeps the form", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        await login(page, "owner");
        const form = await openCreateForm(page);
        const service = serviceWithInfo();
        await changeServiceInfo(service.key, { status: 401 });
        const name = field(page, "Enter a descriptive name for your service");
        await name.fill("Kept");

        await importInto(page, service.address);
        await expect(form.getByRole("alert")).toContainText(
            "only publicly available service info can be imported",
        );
        await expect(name).toHaveValue("Kept");
        const expected = problems.splice(0);
        expect(expected.every((val) => val.includes("/services/import"))).toBe(
            true,
        );

        // an address that isn't one of a service info: the registry's reason
        await importInto(page, service.url);
        await expect(form.getByRole("alert")).toBeVisible();
        await expect(name).toHaveValue("Kept");
        problems.splice(0);
    });

    test("above the limit, the import asks to wait", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        await login(page, "owner");
        const form = await openCreateForm(page);
        await page.route(`${registry}/services/import`, (route) =>
            route.fulfill({
                status: 429,
                contentType: "application/problem+json",
                headers: {
                    "Retry-After": "60",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Expose-Headers": "Retry-After",
                },
                body: JSON.stringify({ status: 429, title: "Too many" }),
            }),
        );
        await importInto(page, serviceWithInfo().address);
        await expect(form.getByRole("alert")).toContainText("too often");
        await expect(form.getByRole("alert")).toContainText(
            "try again in about 1 minute",
        );
        // the 429, which the app handles
        problems.splice(0);
    });

    test("a service type that users may not add is left to choose", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        // new types are for admins here
        await publishRules(page, { serviceTypes: "controlled" });
        await page.route(`${registry}/me`, async (route) => {
            const response = await route.fetch();
            await route.fulfill({
                response,
                json: { ...(await response.json()), mayAddServiceTypes: false },
            });
        });
        await login(page, "owner");
        const form = await openCreateForm(page);
        const service = serviceWithInfo();
        await changeServiceInfo(service.key, {
            type: { group: "org.ga4gh", artifact: "tes", version: "0.9.9" },
        });

        await importInto(page, service.address);
        await expect(
            form.getByText(
                "The service type org.ga4gh · tes · 0.9.9 isn't registered",
            ),
        ).toBeVisible();
        const box = form.getByRole("checkbox", { name: syncBox });
        await expect(box).toBeDisabled();
        await expect(
            page.getByRole("button", { name: "Create Service" }),
        ).toBeDisabled();
        await page
            .getByRole("button", { name: "Select a service type" })
            .click();
        await page
            .getByRole("option", { name: "org.ga4gh · tes · 1.1.0" })
            .click();
        await expect(
            form.getByText("isn't registered", { exact: false }),
        ).toBeHidden();
        await expect(box).toBeDisabled();
    });

    test("the rule says how often, or hides the sync", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        await publishRules(page, {
            serviceInfoSync: { enabled: true, intervalHours: 6 },
        });
        await login(page, "owner");
        let form = await openCreateForm(page);
        await expect(
            form.getByRole("checkbox", { name: syncBox }),
        ).toHaveAccessibleName(/every 6 hours/);

        await page.keyboard.press("Escape");
        await expect(form).toBeHidden();
        await page.unroute(`${registry}/service-info`);
        await publishRules(page, {
            serviceInfoSync: { enabled: false, intervalHours: 24 },
        });
        await page.reload();
        await page.waitForLoadState("networkidle");
        form = await openCreateForm(page);
        // imports don't depend on it
        await expect(form.getByText("Import from service info")).toBeVisible();
        await expect(form.getByRole("checkbox", { name: syncBox })).toHaveCount(
            0,
        );

        const service = serviceWithInfo();
        await importInto(page, service.address);
        await expect(
            field(page, "Enter a descriptive name for your service"),
        ).toHaveValue(service.name);
    });

    test("registries that can't import offer neither", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        await publishRules(page, { serviceInfoSync: undefined });
        await login(page, "owner");
        const form = await openCreateForm(page);
        await expect(form.getByText("Service Name")).toBeVisible();
        await expect(form.getByText("Import from service info")).toHaveCount(0);
        await expect(form.getByRole("checkbox", { name: syncBox })).toHaveCount(
            0,
        );
    });
});
