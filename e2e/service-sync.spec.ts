import type { Page } from "@playwright/test";
import {
    addTesType,
    api,
    changeServiceInfo,
    expect,
    login,
    publishRules,
    registerService,
    registry,
    serviceWithInfo,
    test,
    tokenOf,
} from "./fixtures";

/**
 * Register a service of the stack with service info, with sync on
 * @param token Access token of its owner
 * @returns The service, with its ID
 */
async function syncedService(token: string) {
    const service = serviceWithInfo();
    const values = await api(token, "POST", "/services/import", {
        serviceInfoUrl: service.address,
    });
    expect(values.status).toBe(200);
    const created = await api(token, "POST", "/services", values.body);
    expect(created.status).toBe(201);
    const id = String(created.body);
    const sync = await api(token, "PUT", `/services/${id}/sync`);
    expect(sync.status).toBe(200);
    return { ...service, id };
}

/**
 * Get the row of a service in the list
 * @param page Page with the list
 * @param name Name of the service
 * @returns The row, after searching for it
 */
async function listed(page: Page, name: string) {
    await page.getByLabel("Search services").fill(name);
    return page.getByRole("row").filter({ hasText: name });
}

test.describe("syncing services", () => {
    test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    test("the list and details show the label, also to guests", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const owner = await tokenOf(browser, "owner");
        const service = await syncedService(owner);

        await page.goto("/dashboard/services");
        const row = await listed(page, service.name);
        await expect(row.getByText("Synced")).toBeVisible();

        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(page.getByText("Synced", { exact: true })).toBeVisible();
        await expect(page.getByText("Last Success")).toBeVisible();
        // where the labels are explained
        await expect(
            page.getByText("Verified and synced doesn't mean trusted"),
        ).toBeVisible();
        // only those with a role have the controls
        await expect(
            page.getByRole("button", { name: "Sync now" }),
        ).toHaveCount(0);
    });

    test("a manual entry has no label, and owners can turn sync on", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = serviceWithInfo();
        const values = await api(token, "POST", "/services/import", {
            serviceInfoUrl: service.address,
        });
        const created = await api(token, "POST", "/services", values.body);
        const id = String(created.body);
        await page.goto(`/dashboard/services/view/${id}`);
        await expect(page.getByText("This service isn't synced")).toBeVisible();
        await expect(page.getByText("Synced", { exact: true })).toHaveCount(0);

        await page.getByRole("button", { name: "Turn sync on" }).click();
        const confirm = page.getByRole("alertdialog");
        await expect(confirm).toContainText("overrides manual changes");
        await confirm.getByRole("button", { name: "Turn sync on" }).click();
        await expect(page.getByText("Synced", { exact: true })).toBeVisible();
        await expect(
            page.getByText("Sync is on: the service follows"),
        ).toBeVisible();

        await page.getByRole("button", { name: "Turn sync off" }).click();
        await expect(page.getByText("Sync is off")).toBeVisible();
        await expect(page.getByText("Synced", { exact: true })).toHaveCount(0);
        expect((await api(token, "GET", `/services/${id}/sync`)).status).toBe(
            404,
        );
    });

    test("sync now applies changes, and shows a reason if it can't", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = await syncedService(token);
        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(page.getByText("Synced", { exact: true })).toBeVisible();

        await changeServiceInfo(service.key, { name: `${service.name} new` });
        await page.getByRole("button", { name: "Sync now" }).click();
        await expect(
            page.getByText(`${service.name} new`).first(),
        ).toBeVisible();

        // another API: refused at once, and nothing changes
        await changeServiceInfo(service.key, {
            type: { group: "org.ga4gh", artifact: "wes", version: "1.1.0" },
        });
        await page.getByRole("button", { name: "Sync now" }).click();
        await expect(
            page.getByText(/describes another type of service/),
        ).toBeVisible();
        await expect(page.getByText("Synced", { exact: true })).toBeVisible();
        problems.splice(0);

        // an unknown version: the registry keeps the values, and tells why
        await changeServiceInfo(service.key, {
            type: { group: "org.ga4gh", artifact: "tes", version: "9.9.9" },
        });
        await page.getByRole("button", { name: "Sync now" }).click();
        await expect(
            page.getByText("Out of sync", { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("status")).toContainText("service type");

        const mine = await api(token, "GET", "/notifications");
        expect(
            mine.body.some(
                (val: { serviceId?: string; type: string }) =>
                    val.serviceId === service.id && val.type === "out-of-sync",
            ),
        ).toBe(true);
    });

    test("a failed fetch changes nothing, and says so", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = await syncedService(token);
        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(page.getByText("Synced", { exact: true })).toBeVisible();

        await changeServiceInfo(service.key, { status: 503 });
        await page.getByRole("button", { name: "Sync now" }).click();
        await expect(
            page.getByText("The registry could not fetch the service info."),
        ).toBeVisible();
        await expect(page.getByText("Synced", { exact: true })).toBeVisible();
        const expected = problems.splice(0);
        expect(expected.every((val) => val.includes("/sync"))).toBe(true);
    });

    test("the edit form says that the URL is locked", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = await syncedService(token);
        await page.goto(`/dashboard/services/update/${service.id}`);
        await expect(
            page.getByText("the next sync overrides manual changes"),
        ).toBeVisible();

        await page.getByLabel("Service URL").fill(`${service.url}/moved`);
        await expect(
            page.getByText("so its URL can't change. To move it").first(),
        ).toBeVisible();
        expect(
            (await api(token, "GET", `/services/${service.id}`)).body.url,
        ).toBe(service.url);
    });

    test("the form shows if the registry refuses a new URL", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = await syncedService(token);
        // sync turned on after this page read it: no warning in advance
        await page.route(`${registry}/services/${service.id}/sync`, (route) =>
            route.fulfill({ status: 404, json: { status: 404 } }),
        );
        await page.goto(`/dashboard/services/update/${service.id}`);
        const locked = page.getByText("so its URL can't change. To move it");
        await page.getByLabel("Service URL").fill(`${service.url}/moved`);
        await expect(locked).toHaveCount(0);

        const refused = page.waitForResponse(
            (val) =>
                val.request().method() === "PUT" &&
                val.url() === `${registry}/services/${service.id}`,
        );
        await page.getByRole("button", { name: "Submit" }).click();
        expect((await refused).status()).toBe(409);
        await expect(locked.first()).toBeVisible();
        const stored = await api(token, "GET", `/services/${service.id}`);
        expect(stored.body.url).toBe(service.url);
        problems.splice(0);
    });

    test("an unknown state isn't shown as no sync", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = await syncedService(token);
        await page.route(`${registry}/services/${service.id}/sync`, (route) =>
            route.fulfill({ status: 500, json: { status: 500 } }),
        );
        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(
            page.getByText("Could not load the sync of this service, so"),
        ).toBeVisible();
        await expect(page.getByText("This service isn't synced")).toHaveCount(
            0,
        );
        await expect(page.getByRole("button", { name: /sync/i })).toHaveCount(
            0,
        );
        problems.splice(0);
    });

    test("sync now doesn't turn on a sync turned off meanwhile", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = await syncedService(token);
        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(page.getByText("Synced", { exact: true })).toBeVisible();

        await api(token, "DELETE", `/services/${service.id}/sync`);
        await page.getByRole("button", { name: "Sync now" }).click();
        await expect(page.getByText("Sync was turned off")).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Turn sync on" }),
        ).toBeVisible();
        expect(
            (await api(token, "GET", `/services/${service.id}/sync`)).status,
        ).toBe(404);
    });

    test("a failed list of syncs says so", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        await syncedService(await tokenOf(browser, "owner"));
        await page.route(`${registry}/syncs`, (route) =>
            route.fulfill({ status: 500, json: { status: 500 } }),
        );
        await page.goto("/dashboard/services");
        await expect(page.getByText("Could not load the syncs")).toBeVisible();
        problems.splice(0);
    });

    test("Synced only filters the list", async ({ page, browser }) => {
        await addTesType(browser);
        const owner = await tokenOf(browser, "owner");
        const synced = await syncedService(owner);
        const manual = await registerService(browser, "owner", "Manual");

        await page.goto("/dashboard/services");
        await page
            .getByRole("button", { name: "Show synced services only" })
            .click();
        await expect(
            page.getByText("Verified and synced doesn't mean trusted"),
        ).toBeVisible();
        await page.getByLabel("Search services").fill(synced.name);
        await expect(
            page.getByRole("row", { name: synced.name }),
        ).toBeVisible();
        await page.getByLabel("Search services").fill(manual.name);
        await expect(page.getByText("Showing 1-1")).toHaveCount(0);
        await expect(page.getByRole("row", { name: manual.name })).toHaveCount(
            0,
        );
    });

    test("deployments that don't sync show no sync", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const owner = await tokenOf(browser, "owner");
        const service = await registerService(browser, "owner", "No sync");
        expect(owner).toBeTruthy();
        await publishRules(page, {
            serviceInfoSync: { enabled: false, intervalHours: 24 },
        });
        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(page.getByText("Service Details")).toBeVisible();
        await expect(page.getByText("Sync with service info")).toHaveCount(0);
        await page.goto("/dashboard/services");
        await expect(
            page.getByRole("button", { name: "Show synced services only" }),
        ).toHaveCount(0);
    });
});
