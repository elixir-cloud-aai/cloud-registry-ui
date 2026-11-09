import type { Browser, Page, Request } from "@playwright/test";
import {
    api,
    expect,
    isApprovalsRead,
    isRead,
    login,
    newService,
    openPage,
    registry,
    serviceReads,
    test,
    tokenOf,
    waitForReads,
} from "./fixtures";

const path = "/service-info/listing";
const url = `${registry}${path}`;

/**
 * Leave the registry unlisted, as the other tests expect it
 * @param browser Browser
 */
async function unlist(browser: Browser) {
    // 404 if it isn't listed
    await api(await tokenOf(browser, "admin"), "DELETE", path);
}

/**
 * Get the service info, which the entry is built from
 * @returns The service info
 */
async function serviceInfo() {
    return (await api(undefined, "GET", "/service-info")).body;
}

/**
 * Open the service info page in admin mode
 * @param page Page
 * @returns The region of the listing
 */
async function openListing(page: Page) {
    await login(page, "admin", { adminMode: true });
    await page.goto("/dashboard/service-info");
    return page.getByRole("region", { name: "Service Listing" });
}

/**
 * Open a page by the sidebar, without loading the app again, as an admin:
 * the pages with lists also read the pending entries then
 * @param page Page
 * @param link Name of the link
 * @param list Path below the API's base URL that the page reads
 * @returns The answer of the registry to the page's request
 */
async function openByLink(page: Page, link: string, list: string) {
    // the list, and the admin's read of the pending entries
    const [answer] = await waitForReads(
        page,
        () =>
            page.getByRole("link", { name: link, exact: true }).first().click(),
        [(val) => val.url() === `${registry}${list}`, isApprovalsRead],
    );
    return answer.json();
}

/**
 * Let requests of the page for the listing fail
 * @param page Page
 * @param method HTTP method of the requests to fail
 * @param status HTTP status
 * @param body Body of the response
 */
async function failListing(
    page: Page,
    method: string,
    status: number,
    body: object,
) {
    await page.route(url, (route) =>
        route.request().method() === method
            ? route.fulfill({
                  status,
                  contentType: "application/problem+json",
                  body: JSON.stringify({ status, ...body }),
              })
            : route.fallback(),
    );
}

/**
 * Drop the messages about failures of the listing that a test causes on
 * purpose, so that only other problems fail it
 * @param problems Problems of the page
 */
function dropFailures(problems: string[]) {
    const others = problems.filter(
        (val) => !val.includes(url) && !val.includes("listing of the registry"),
    );
    problems.splice(0, problems.length, ...others);
}

test.describe("listing of the registry", () => {
    // the tests change the registry's own entry, of which there is one
    test.beforeEach(async ({ browser }) => {
        await unlist(browser);
    });

    test.afterEach(async ({ browser }) => {
        await unlist(browser);
    });

    test("admins add the registry and remove it, and the lists follow", async ({
        page,
    }) => {
        const info = await serviceInfo();
        const ids = (val: { id: string }[]) => val.map((item) => item.id);
        const types = (val: { artifact: string }[]) =>
            val.map((item) => item.artifact);

        const region = await openListing(page);
        await expect(region).toContainText("isn't listed");
        await region.getByRole("button", { name: "Add to services" }).click();
        await expect(
            page.getByText("The registry is listed among its services."),
        ).toBeVisible();
        await expect(region.getByRole("link", { name: info.id })).toBeVisible();

        // the pages load what the operation changed
        expect(ids(await openByLink(page, "Services", "/services"))).toContain(
            info.id,
        );
        expect(
            types(await openByLink(page, "Service Types", "/services/types")),
        ).toContain(info.type.artifact);

        // listed after a reload, and the link opens the entry
        await page.goto("/dashboard/service-info");
        await waitForReads(
            page,
            () => region.getByRole("link", { name: info.id }).click(),
            serviceReads(info.id),
        );
        await page.waitForURL(`**/dashboard/services/view/${info.id}`);
        await expect(page.getByText(info.name).first()).toBeVisible();

        await page.goto("/dashboard/service-info");
        await region
            .getByRole("button", { name: "Remove from services" })
            .click();
        await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Remove" })
            .click();
        await expect(
            page.getByText(
                "The registry is no longer listed among its services.",
            ),
        ).toBeVisible();
        await expect(region).toContainText("isn't listed");
        await expect(
            region.getByRole("button", { name: "Add to services" }),
        ).toBeVisible();

        expect(
            ids(await openByLink(page, "Services", "/services")),
        ).not.toContain(info.id);
        expect(
            types(await openByLink(page, "Service Types", "/services/types")),
        ).not.toContain(info.type.artifact);
    });

    test("the registry's own entry offers no sync", async ({
        page,
        browser,
    }) => {
        const info = await serviceInfo();
        await api(await tokenOf(browser, "admin"), "PUT", path);
        await login(page, "admin", { adminMode: true });
        await waitForReads(
            page,
            () => page.goto(`/dashboard/services/view/${info.id}`),
            serviceReads(info.id),
        );
        await expect(
            page.getByText("This is the registry's own entry"),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Turn sync on" }),
        ).toHaveCount(0);
    });

    test("the button and the request are for admin mode only", async ({
        page,
        browser,
    }) => {
        /**
         * Check that a page has no listing, once it has loaded
         * @param val Page
         */
        const expectNone = async (val: Page) => {
            // the page's reads, that of the user's roles included, which
            // the listing's read would follow
            await openPage(val, "/dashboard/service-info", [
                isRead("/service-info"),
            ]);
            await expect(val.getByText("Registry Version")).toBeVisible();
            await expect(
                val.getByRole("region", { name: "Service Listing" }),
            ).toHaveCount(0);
        };
        const requests: string[] = [];
        const record = (request: Request) => {
            if (request.url() === url) requests.push(request.method());
        };
        page.on("request", record);

        // guests, and admins in user mode
        await expectNone(page);
        await login(page, "admin");
        await expectNone(page);
        expect(requests).toEqual([]);

        // other users, whatever their mode
        const context = await browser.newContext();
        const other = await context.newPage();
        other.on("request", record);
        await login(other, "other");
        await expectNone(other);
        await context.close();
        expect(requests).toEqual([]);

        // the same user in admin mode
        await page.getByRole("button", { name: "User mode" }).click();
        await expect(
            page.getByRole("region", { name: "Service Listing" }),
        ).toBeVisible();
        expect(requests).toContain("GET");
    });

    test("another service with the URL and API type is named", async ({
        page,
        browser,
        problems,
    }) => {
        const token = await tokenOf(browser, "admin");
        const info = await serviceInfo();
        const { group, artifact, version } = info.type;
        await api(token, "POST", "/services/types", {
            group,
            artifact,
            version,
        });
        const created = await api(token, "POST", "/services", {
            ...newService("Same URL"),
            url: registry,
            type: info.type,
        });
        expect(created.status).toBe(201);
        try {
            const region = await openListing(page);
            await region
                .getByRole("button", { name: "Add to services" })
                .click();

            const toast = page
                .locator("[data-sonner-toast]")
                .filter({ hasText: "delete that service first" });
            await expect(toast).toBeVisible();
            await expect(
                toast.getByRole("button", { name: "View service" }),
            ).toBeVisible();
            await expect(region).toContainText("isn't listed");
            dropFailures(problems);
        } finally {
            const type = new URLSearchParams({ group, artifact, version });
            await api(token, "DELETE", `/services/${created.body}`);
            await api(token, "DELETE", `/services/types?${type}`);
        }
    });

    test("removing an entry that is gone shows the current state", async ({
        page,
        browser,
        problems,
    }) => {
        const token = await tokenOf(browser, "admin");
        expect((await api(token, "PUT", path)).status).toBe(201);
        const region = await openListing(page);
        await expect(
            region.getByRole("button", { name: "Remove from services" }),
        ).toBeVisible();
        await api(token, "DELETE", path);

        await region
            .getByRole("button", { name: "Remove from services" })
            .click();
        await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Remove" })
            .click();

        await expect(
            page.getByText(
                "The registry's entry was removed by another request.",
            ),
        ).toBeVisible();
        await expect(
            region.getByRole("button", { name: "Add to services" }),
        ).toBeVisible();
        dropFailures(problems);
    });

    // answers that the stack's registry doesn't give with its settings
    for (const [name, status, body, message] of [
        [
            "a refused environment",
            400,
            { title: "Bad Request", detail: "The environment isn't allowed." },
            "The environment isn't allowed.",
        ],
        [
            "a pending service type",
            409,
            {
                title: "Conflict",
                code: "pending-service",
                detail: "The service type of the registry is pending.",
            },
            "The service type of the registry is pending.",
        ],
        [
            "a taken identifier",
            409,
            {
                title: "Conflict",
                code: "service-id-taken",
                detail: "A service with the identifier is registered.",
            },
            "A service with the identifier is registered.",
        ],
        [
            "a busy entry",
            409,
            { title: "Conflict", code: "service-busy", detail: "Busy." },
            "Please try again in a moment.",
        ],
    ] as const) {
        test(`shows the reason for ${name}`, async ({ page, problems }) => {
            await failListing(page, "PUT", status, body);
            const region = await openListing(page);

            await region
                .getByRole("button", { name: "Add to services" })
                .click();

            await expect(page.getByText(message)).toBeVisible();
            await expect(region).toContainText("isn't listed");
            dropFailures(problems);
        });
    }

    test("says so if it can't tell whether the registry is listed", async ({
        page,
        problems,
    }) => {
        await failListing(page, "GET", 500, { title: "Internal Server Error" });
        const region = await openListing(page);

        await expect(region).toContainText("Could not check");
        await expect(
            region.getByRole("button", { name: "Add to services" }),
        ).toHaveCount(0);

        const retry = region.getByRole("button", { name: "Try again" });
        await retry.click();
        await expect(
            page.getByText("Still can't check whether the registry is listed."),
        ).toBeVisible();
        await expect(retry).toBeEnabled();

        await page.unroute(url);
        await retry.click();
        await expect(
            region.getByRole("button", { name: "Add to services" }),
        ).toBeVisible();
        dropFailures(problems);
    });

    test("keeps the state if it can't be read after a failed change", async ({
        page,
        problems,
    }) => {
        await failListing(page, "PUT", 401, { title: "Unauthorized" });
        const region = await openListing(page);
        const add = region.getByRole("button", { name: "Add to services" });
        await expect(add).toBeVisible();
        await failListing(page, "GET", 500, {
            title: "Internal Server Error",
        });

        const reread = page.waitForResponse(
            (val) => val.url() === url && val.request().method() === "GET",
        );
        await add.click();

        await expect(page.getByText("session expired")).toBeVisible();
        await reread;
        await expect(add).toBeEnabled();
        await expect(region).not.toContainText("Could not check");
        dropFailures(problems);
    });
});
