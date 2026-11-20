import type { Page } from "@playwright/test";
import {
    addTesType,
    api,
    changeServiceInfo,
    expect,
    isRead,
    login,
    newService,
    openPage,
    registry,
    serviceWithInfo,
    test,
    tokenOf,
    waitForReads,
} from "./fixtures";

const path = "/dashboard/failed-operations";

/**
 * Match the registry's list of failures, whatever the query
 * @param url URL of a request
 * @returns Whether it is that of the list
 */
function isFailures(url: URL) {
    return `${url.origin}${url.pathname}` === `${registry}/failures`;
}

/**
 * Let an import fail: the service info answers with 503
 * @param token Access token of the user who imports
 * @returns The address of the service info
 */
async function failedImport(token: string) {
    const service = serviceWithInfo();
    await changeServiceInfo(service.key, { status: 503 });
    const imported = await api(token, "POST", "/services/import", {
        serviceInfoUrl: service.address,
    });
    expect(imported.status).toBeGreaterThanOrEqual(400);
    return service;
}

/**
 * Open the view, with filters
 * @param page Page
 * @param query Query of the address, if any
 */
async function openFailures(page: Page, query = "") {
    await openPage(page, `${path}${query}`, [isRead("/failures")]);
}

/**
 * Get the row of a failure
 * @param page Page
 * @param text Text in the row, e.g. the service's URL
 * @returns The row
 */
function row(page: Page, text: string) {
    return page.getByRole("row").filter({ hasText: text });
}

/**
 * Wait until the page shows the list that it read, or that there is none
 * @param page Page with the view
 */
async function expectLoaded(page: Page) {
    await expect(page.getByText("Loading...")).toHaveCount(0);
    await expect(
        page.getByRole("table").or(page.getByText(/^No failed operations/)),
    ).toBeVisible();
}

/**
 * Choose a filter, and wait for the list that it reads
 * @param page Page with the view
 * @param label Label of the filter
 * @param option The option
 */
async function filterBy(page: Page, label: string, option: string) {
    await page.getByLabel(label).click();
    await waitForReads(
        page,
        () => page.getByRole("option", { name: option }).click(),
        [isRead("/failures")],
    );
    await expectLoaded(page);
}

test.describe("failed operations", () => {
    test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    test("guests are asked to log in, and have no link", async ({ page }) => {
        await page.goto(path);
        await expect(
            page.getByText("Log in to see failed operations."),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Failed operations", exact: true }),
        ).toHaveCount(0);
    });

    test("users see their failed imports, without why a fetch failed", async ({
        page,
    }) => {
        const token = await login(page, "owner");
        const service = await failedImport(token);
        // the link next to the bell
        await page
            .getByRole("link", { name: "Failed operations", exact: true })
            .click();
        await page.waitForURL(`**${path}`);
        const failure = row(page, service.url);
        await expect(failure).toContainText("Import");
        await expect(failure).toContainText("Fetch failed");
        await expect(failure).toContainText("only the registry's admins");
        // their own: with who acted
        await expect(failure).toContainText("bob@lifescience-ri.eu");
    });

    test("on phones, the list of notifications leads there", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await login(page, "owner");
        await expect(
            page.getByRole("link", { name: "Failed operations", exact: true }),
        ).toBeHidden();
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await page
            .getByRole("link", { name: "View failed operations" })
            .click();
        await page.waitForURL(`**${path}`);
        await expect(
            page.getByRole("heading", { name: "Failed Operations" }),
        ).toBeVisible();
    });

    test("the user menu leads there", async ({ page }) => {
        await login(page, "owner");
        await page
            .getByRole("button", { name: "bob@lifescience-ri.eu" })
            .click();
        await page.getByRole("menuitem", { name: "Failed operations" }).click();
        await page.waitForURL(`**${path}`);
        await expectLoaded(page);
    });

    test("other users don't see them", async ({ page, browser }) => {
        const owner = await tokenOf(browser, "owner");
        const service = await failedImport(owner);
        // recorded: the owner sees it
        const own = await api(owner, "GET", "/failures");
        expect(
            own.body.failures.some(
                (val: { url?: string }) => val.url === service.url,
            ),
        ).toBe(true);
        await login(page, "other");
        await openFailures(page);
        await expectLoaded(page);
        await expect(row(page, service.url)).toHaveCount(0);
    });

    test("admins in admin mode see all, with why a fetch failed", async ({
        page,
        browser,
    }) => {
        const service = await failedImport(await tokenOf(browser, "owner"));
        await login(page, "admin", { adminMode: true });
        await openFailures(page);
        const failure = row(page, service.url);
        await expect(failure).toContainText("Unreachable");
        await expect(failure).toContainText("bob@lifescience-ri.eu");
    });

    test("filters by operation and reason, in the address", async ({
        page,
    }) => {
        const token = await login(page, "owner");
        const service = await failedImport(token);
        await openFailures(page);
        await expect(row(page, service.url)).toHaveCount(1);

        // the registry filters: the list asks for the operation
        const asked: string[] = [];
        page.on("request", (request) => {
            const url = new URL(request.url());
            if (isFailures(url)) asked.push(url.search);
        });
        await filterBy(page, "Filter by operation", "Sync");
        await page.waitForURL(`**${path}?operation=sync`);
        await expect(row(page, service.url)).toHaveCount(0);
        expect(asked.at(-1)).toContain("operation=sync");

        await filterBy(page, "Filter by operation", "Import");
        await filterBy(page, "Filter by reason", "Not JSON");
        await page.waitForURL(`**${path}?operation=import&reason=not+JSON`);
        await expect(row(page, service.url)).toHaveCount(0);

        await filterBy(page, "Filter by reason", "Fetch failed");
        await page.waitForURL(`**${path}?operation=import&reason=fetch+failed`);
        await expect(row(page, service.url)).toHaveCount(1);
        expect(asked.at(-1)).toContain("reason=fetch+failed");

        await waitForReads(
            page,
            () => page.getByRole("button", { name: "Clear filters" }).click(),
            [isRead("/failures")],
        );
        await page.waitForURL(`**${path}`);
        await expectLoaded(page);
        await expect(row(page, service.url)).toHaveCount(1);
    });

    test("a service's page leads to its failures", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        // an update to the URL of another service of the same type fails
        const first = newService("Failures first");
        const second = newService("Failures second");
        const created = await api(token, "POST", "/services", first);
        expect(created.status).toBe(201);
        const id = String((await api(token, "POST", "/services", second)).body);
        const update = await api(token, "PUT", `/services/${id}`, {
            ...second,
            url: first.url,
        });
        expect(update.status).toBe(409);

        await openPage(page, `/dashboard/services/view/${id}`, [
            isRead(`/services/${id}`),
        ]);
        // the service's, at the top of its details, not the one next to
        // the bell
        await page
            .getByRole("link", { name: "Failed operations of this service" })
            .click();
        await page.waitForURL(`**${path}?serviceId=${id}`);
        await expect(page.getByLabel("Filter by service ID")).toHaveValue(id);
        const failure = row(page, id);
        await expect(failure).toContainText("Update");
        await expect(failure).toContainText("Duplicate service");
        await expect(page.getByRole("row")).toHaveCount(2);
    });

    test("loads more pages", async ({ page }) => {
        const failure = (n: number) => ({
            id: `f${n}`,
            occurredAt: new Date(Date.now() - n * 60_000).toISOString(),
            operation: "update",
            reason: "invalid field",
            serviceId: `svc-${n}`,
            fields: ["organization.url"],
        });
        await page.route(isFailures, (route) => {
            const token = new URL(route.request().url()).searchParams.get(
                "pageToken",
            );
            return route.fulfill({
                json: token
                    ? { failures: [failure(2)] }
                    : {
                          failures: [failure(1)],
                          nextPageToken: "1.0123456789abcdef01234567",
                      },
            });
        });
        await login(page, "owner");
        await page.goto(path);
        await expect(row(page, "svc-1")).toContainText("organization.url");
        await page.getByRole("button", { name: "Load more" }).click();
        await expect(row(page, "svc-2")).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Load more" }),
        ).toHaveCount(0);
    });

    test("registries without the list say so", async ({ page, problems }) => {
        await page.route(isFailures, (route) =>
            route.fulfill({ status: 404, json: { message: "Not found" } }),
        );
        await login(page, "owner");
        await page.goto(path);
        // the page's alert, not Next's announcer of routes
        await expect(
            page.getByText("This registry doesn't list failed operations"),
        ).toBeVisible();
        // the browser logs the 404, which the app handles
        expect(problems.every((val) => val.includes("404"))).toBe(true);
        problems.length = 0;
    });
});
