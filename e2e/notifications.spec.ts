import type { Page } from "@playwright/test";
import {
    addTesType,
    api,
    changeServiceInfo,
    expect,
    isApprovalsRead,
    isRead,
    login,
    openPage,
    registry,
    serviceWithInfo,
    sessionCookie,
    test,
    tokenOf,
    waitForReads,
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

/**
 * Get a notification of a service that is out of sync
 * @param id Its identifier, and that of the service
 * @returns The notification
 */
function item(id: string) {
    return { id, type: "out-of-sync", serviceId: id, reason: "unreachable" };
}

/**
 * Let the bell read again now, instead of within a minute
 * @param page Page with the bell
 */
async function readAgain(page: Page) {
    await page.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
    );
}

test.describe("notifications", () => {
    test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    test("guests have no bell", async ({ page }) => {
        await openPage(page, "/dashboard/services", [isRead("/services")]);
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
        await waitForReads(page, () => page.reload(), [isApprovalsRead]);

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

        // gone also in the registry
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
        // the reads after the switch, that of the bell included, have
        // finished
        await login(page, "admin", { adminMode: true });
        expect(adminRole).toBe(true);
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await expect(
            page.getByText(`${service.name} is out of sync`),
        ).toBeVisible();
    });

    test("names pending services, which only the user's token lists", async ({
        page,
    }) => {
        await page.route(`${registry}/notifications`, (route) =>
            route.request().method() === "GET"
                ? route.fulfill({
                      json: [
                          {
                              id: "1",
                              type: "pending-service",
                              serviceId: "x",
                              reason: "pending",
                          },
                      ],
                  })
                : route.fallback(),
        );
        await page.route(`${registry}/services`, (route) =>
            route.request().method() === "GET"
                ? route.fulfill({
                      json: route.request().headers().authorization
                          ? [{ id: "x", name: "Pending TES" }]
                          : [],
                  })
                : route.fallback(),
        );
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await expect(
            page.getByText("Pending TES awaits approval"),
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

    test("a registry without notifications shows no bell", async ({
        page,
        problems,
    }) => {
        await page.route(`${registry}/notifications`, (route) =>
            route.fulfill({ status: 404, json: { status: 404 } }),
        );
        await login(page, "other");
        await expect(
            page.getByRole("button", { name: /^Notifications/ }),
        ).toHaveCount(0);
        problems.splice(0);
    });

    test("a registry without notifications isn't asked again", async ({
        page,
        problems,
    }) => {
        let reads = 0;
        await page.route(`${registry}/notifications`, (route) => {
            reads++;
            return route.fulfill({ status: 404, json: { status: 404 } });
        });
        await login(page, "other");
        // the bell reads again neither while the read runs nor once it has
        // failed
        await expect.poll(() => reads).toBeGreaterThan(0);
        const before = reads;
        await readAgain(page);
        await page.waitForTimeout(500);
        expect(reads).toBe(before);
        problems.splice(0);
    });

    test("refused notifications show no bell, and aren't asked again", async ({
        page,
        problems,
    }) => {
        let reads = 0;
        let answered = 0;
        await page.route(`${registry}/notifications`, async (route) => {
            reads++;
            // e.g. a policy of the registry without the rules for them
            await route.fulfill({ status: 403, json: { status: 403 } });
            answered++;
        });
        let warned = false;
        page.on("console", (msg) => {
            if (msg.type() === "warning" && msg.text().includes("refuses"))
                warned = true;
        });
        await login(page, "other");
        // once the refusal is handled, so that a read under way can't hide
        // another one
        await expect.poll(() => answered).toBeGreaterThan(0);
        await expect.poll(() => warned).toBe(true);
        await expect(
            page.getByRole("button", { name: /^Notifications/ }),
        ).toHaveCount(0);
        const before = reads;
        await readAgain(page);
        await page.waitForTimeout(500);
        expect(reads).toBe(before);
        problems.splice(0);
    });

    test("a refused login removes the list, and stops reading", async ({
        page,
        problems,
    }) => {
        let reads = 0;
        let refuse = false;
        await page.route(`${registry}/notifications`, (route) => {
            reads++;
            return refuse
                ? route.fulfill({ status: 401, json: { status: 401 } })
                : route.fulfill({ json: [item("x")] });
        });
        await login(page, "other");
        const bell = page.getByRole("button", { name: /^Notifications/ });
        await bell.click();
        await expect(page.getByText("x is out of sync")).toBeVisible();

        refuse = true;
        await readAgain(page);
        await expect(page.getByText("x is out of sync")).toHaveCount(0);
        await expect(bell).toHaveCount(0);
        const before = reads;
        await readAgain(page);
        await page.waitForTimeout(500);
        expect(reads).toBe(before);
        problems.splice(0);
    });

    test("a login refused on dismissal removes the list", async ({
        page,
        problems,
    }) => {
        await page.route(`${registry}/notifications`, (route) =>
            route.fulfill({ json: [item("x")] }),
        );
        await page.route(`${registry}/notifications/x`, (route) =>
            route.fulfill({ status: 401, json: { status: 401 } }),
        );
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await page
            .getByRole("button", { name: "Dismiss: x is out of sync" })
            .click();
        await expect(
            page.getByRole("button", { name: /^Notifications/ }),
        ).toHaveCount(0);
        await expect(
            page.getByText("Could not dismiss this notification."),
        ).toHaveCount(0);
        problems.splice(0);
    });

    test("a logout elsewhere removes the list", async ({ page, context }) => {
        await page.route(`${registry}/notifications`, (route) =>
            route.fulfill({ json: [item("x")] }),
        );
        await login(page, "other");
        const bell = page.getByRole("button", { name: /^Notifications/ });
        await bell.click();
        await expect(page.getByText("x is out of sync")).toBeVisible();

        await context.clearCookies({ name: sessionCookie.accessToken });
        await readAgain(page);
        await expect(page.getByText("x is out of sync")).toHaveCount(0);
        await expect(bell).toHaveCount(0);
    });

    test("a login elsewhere removes the list of the other", async ({
        page,
    }) => {
        await page.route(`${registry}/notifications`, (route) =>
            route.fulfill({
                json:
                    route.request().headers().authorization === "Bearer other"
                        ? []
                        : [item("x")],
            }),
        );
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await expect(page.getByText("x is out of sync")).toBeVisible();

        await page.evaluate((name) => {
            // biome-ignore lint/suspicious/noDocumentCookie: the test switches the user as a login does, with a cookie the app reads
            document.cookie = `${name}=other; path=/; secure`;
        }, sessionCookie.accessToken);
        await readAgain(page);
        await expect(page.getByText("x is out of sync")).toHaveCount(0);
    });

    test("an answer that got lost doesn't bring it back for long", async ({
        page,
        problems,
    }) => {
        let listed = ["x"];
        await page.route(`${registry}/notifications`, (route) =>
            route.fulfill({ json: listed.map(item) }),
        );
        await page.route(`${registry}/notifications/x`, async (route) => {
            listed = [];
            await route.abort();
        });
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await page
            .getByRole("button", { name: "Dismiss: x is out of sync" })
            .click();
        await expect(
            page.getByText("Nothing needs your attention."),
        ).toBeVisible();
        await page.waitForTimeout(500);
        await expect(page.getByText("x is out of sync")).toHaveCount(0);
        problems.splice(0);
    });

    test("an older read doesn't bring back a dismissed one", async ({
        page,
    }) => {
        let hold = false;
        let answer = () => {};
        const answered = new Promise<void>((resolve) => {
            answer = resolve;
        });
        let held = 0;
        await page.route(`${registry}/notifications`, async (route) => {
            if (hold) {
                held++;
                await answered;
            }
            await route.fulfill({ json: [item("x")] });
        });
        await page.route(`${registry}/notifications/x`, (route) =>
            route.fulfill({ json: "x" }),
        );
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await expect(page.getByText("x is out of sync")).toBeVisible();

        hold = true;
        await readAgain(page);
        await expect.poll(() => held).toBe(1);
        const gone = page.waitForResponse(`${registry}/notifications/x`);
        await page
            .getByRole("button", { name: "Dismiss: x is out of sync" })
            .click();
        await gone;
        hold = false;
        answer();
        await page.waitForTimeout(500);
        await expect(page.getByText("x is out of sync")).toHaveCount(0);
        await expect(
            page.getByText("Nothing needs your attention."),
        ).toBeVisible();
    });

    test("one already gone counts as dismissed", async ({ page, problems }) => {
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
            route.fulfill({ status: 404, json: { status: 404 } }),
        );
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        const gone = page.waitForResponse(`${registry}/notifications/1`);
        await page
            .getByRole("button", { name: "Dismiss: x is out of sync" })
            .click();
        await gone;
        await page.waitForTimeout(500);
        await expect(
            page.getByText("Nothing needs your attention."),
        ).toBeVisible();
        await expect(
            page.getByText("Could not dismiss this notification."),
        ).toHaveCount(0);
        problems.splice(0);
    });

    test("a failed dismissal brings back only that one", async ({
        page,
        problems,
    }) => {
        let listed = ["x", "y"];
        await page.route(`${registry}/notifications`, (route) =>
            route.fulfill({ json: listed.map(item) }),
        );
        let answerFailure = () => {};
        const failing = new Promise<void>((resolve) => {
            answerFailure = resolve;
        });
        await page.route(`${registry}/notifications/x`, async (route) => {
            await failing;
            await route.fulfill({ status: 500, json: { status: 500 } });
        });
        await page.route(`${registry}/notifications/y`, (route) => {
            listed = ["x"];
            return route.fulfill({ json: "y" });
        });
        await login(page, "other");
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await page
            .getByRole("button", { name: "Dismiss: x is out of sync" })
            .click();
        const gone = page.waitForResponse(`${registry}/notifications/y`);
        await page
            .getByRole("button", { name: "Dismiss: y is out of sync" })
            .click();
        await gone;
        answerFailure();
        await expect(page.getByText("x is out of sync")).toBeVisible();
        await expect(page.getByText("y is out of sync")).toHaveCount(0);
        problems.splice(0);
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
