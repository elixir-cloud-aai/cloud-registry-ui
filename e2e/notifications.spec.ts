import {
    addTesType,
    api,
    changeServiceInfo,
    expect,
    login,
    registry,
    serviceWithInfo,
    test,
    tokenOf,
} from "./fixtures";

/**
 * Register a service with sync that has gone out of sync
 * @param token Access token of its owner
 * @returns The service, with its ID
 */
async function outOfSyncService(token: string) {
    const service = serviceWithInfo();
    const values = await api(token, "POST", "/services/import", {
        serviceInfoUrl: service.address,
    });
    const created = await api(token, "POST", "/services", values.body);
    const id = String(created.body);
    expect((await api(token, "PUT", `/services/${id}/sync`)).status).toBe(200);
    await changeServiceInfo(service.key, {
        type: { group: "org.ga4gh", artifact: "tes", version: "9.9.9" },
    });
    const sync = await api(token, "PUT", `/services/${id}/sync`);
    expect(sync.body.status).toBe("out-of-sync");
    return { ...service, id };
}

test.describe("notifications", () => {
    test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    test("guests have no bell", async ({ page }) => {
        await page.goto("/dashboard/services");
        await page.waitForLoadState("networkidle");
        await expect(
            page.getByRole("button", { name: /^Notifications/ }),
        ).toHaveCount(0);
    });

    test("owners see, follow and dismiss what needs attention", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = await outOfSyncService(token);
        await page.reload();
        await page.waitForLoadState("networkidle");

        const bell = page.getByRole("button", { name: /^Notifications/ });
        await expect(page.getByTestId("notification-count")).toBeVisible();
        await bell.click();
        const title = `${service.name} is out of sync`;
        await expect(page.getByText(title)).toBeVisible();
        await expect(
            page.getByRole("listitem").filter({ hasText: title }),
        ).toContainText("service type");

        await page
            .getByRole("listitem")
            .filter({ hasText: title })
            .getByRole("link", { name: "View service" })
            .click();
        await page.waitForURL(`**/dashboard/services/view/${service.id}`);

        await bell.click();
        await page.getByRole("button", { name: `Dismiss: ${title}` }).click();
        await expect(page.getByText(title)).toHaveCount(0);

        // gone for good, also for the other owners
        const left = await api(token, "GET", "/notifications");
        expect(
            left.body.some(
                (val: { serviceId?: string }) => val.serviceId === service.id,
            ),
        ).toBe(false);
    });

    test("nothing to show has no number", async ({ page }) => {
        await page.route(`${registry}/notifications`, (route) =>
            route.fulfill({ json: [] }),
        );
        await login(page, "other");
        const bell = page.getByRole("button", { name: "Notifications" });
        await expect(bell).toBeVisible();
        await expect(page.getByTestId("notification-count")).toHaveCount(0);
        await bell.click();
        await expect(
            page.getByText("Nothing needs your attention."),
        ).toBeVisible();
    });

    test("other users don't see a service's notifications", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const service = await outOfSyncService(await tokenOf(browser, "owner"));
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await expect(
            page.getByRole("dialog").getByText("Notifications"),
        ).toBeVisible();
        // the list behind it shows the service, which is public
        await expect(
            page.getByRole("dialog").getByText(service.name),
        ).toHaveCount(0);
    });

    test("admins in admin mode see those of all services", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        const service = await outOfSyncService(await tokenOf(browser, "owner"));
        let adminRole = false;
        page.on("request", (request) => {
            if (
                request.url() === `${registry}/notifications` &&
                request.headers()["x-request-roles"] === "admin"
            )
                adminRole = true;
        });
        await login(page, "admin", { adminMode: true });
        await page.waitForLoadState("networkidle");
        expect(adminRole).toBe(true);
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await expect(
            page.getByText(`${service.name} is out of sync`),
        ).toBeVisible();
    });

    test("shows only fixed texts", async ({ page }) => {
        const raw = "connect ECONNREFUSED 10.0.0.1:443";
        await page.route(`${registry}/notifications`, (route) =>
            route.request().method() === "GET"
                ? route.fulfill({
                      json: [
                          {
                              id: "1",
                              type: "out-of-sync",
                              serviceId: "x",
                              reason: raw,
                          },
                      ],
                  })
                : route.fallback(),
        );
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await expect(page.getByText("x is out of sync")).toBeVisible();
        await expect(page.getByText(raw)).toHaveCount(0);
    });

    test("a failed dismissal brings it back", async ({ page, problems }) => {
        await page.route(`${registry}/notifications`, (route) =>
            route.fulfill({
                json: [
                    {
                        id: "1",
                        type: "out-of-sync",
                        serviceId: "x",
                        reason: "unreachable",
                    },
                ],
            }),
        );
        await page.route(`${registry}/notifications/1`, (route) =>
            route.fulfill({ status: 500, json: { status: 500 } }),
        );
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await page
            .getByRole("button", { name: "Dismiss: x is out of sync" })
            .click();
        await expect(
            page.getByText("Could not dismiss this notification."),
        ).toBeVisible();
        await expect(page.getByText("x is out of sync")).toBeVisible();
        problems.splice(0);
    });
});
