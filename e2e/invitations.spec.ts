import type { Page } from "@playwright/test";
import {
    api,
    expect,
    login,
    registerService,
    registry,
    test,
    tokenOf,
    users,
    watchPage,
} from "./fixtures";

/** Buttons that copy the links known to the dialog, newest first */
const copyButtons = (page: Page) =>
    page.getByRole("dialog").getByRole("button", { name: /^Copy link of / });

/** The rows of the invitations table, newest first */
const invitationRows = (page: Page) =>
    page
        .getByRole("dialog")
        .getByRole("row")
        .filter({ has: page.getByRole("button", { name: /^Revoke / }) });

/**
 * Keep what the page copies, as not all browsers let tests read the
 * clipboard
 * @param page Page, before it opens the app
 */
async function watchClipboard(page: Page) {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: async (text: string) => {
                    document.documentElement.dataset.copied = text;
                },
            },
        });
    });
}

/**
 * Copy the link of the newest invitation that has one
 * @param page Page of the service, whose clipboard is watched
 * @returns The link
 */
async function copyLink(page: Page) {
    const html = page.locator("html");
    await html.evaluate((el) => {
        delete el.dataset.copied;
    });
    await copyButtons(page).first().click();
    await expect(html).toHaveAttribute(
        "data-copied",
        /\/invitations#[\w-]{43}$/,
    );
    return (await html.getAttribute("data-copied")) as string;
}

/**
 * Open the "Manage access" dialog of a service, at its invitations
 * @param page Page of the service, logged in as an owner
 */
async function openInvitations(page: Page) {
    await page.getByRole("button", { name: "Manage access" }).click();
    await page
        .getByRole("dialog")
        .getByRole("tab", { name: /^Invitations/ })
        .click();
}

/**
 * Create an invitation link in the "Manage access" dialog of a service
 * @param page Page of the service, logged in as an owner, whose clipboard is
 * watched
 * @returns The link
 */
async function createLink(page: Page) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible())) await openInvitations(page);
    const before = await copyButtons(page).count();
    await dialog.getByRole("button", { name: "Create link" }).click();
    await expect(copyButtons(page)).toHaveCount(before + 1);
    return copyLink(page);
}

test.describe("invitations", () => {
    test("owners invite users by link, who accept it once", async ({
        page,
        browser,
        baseURL,
    }) => {
        // three logins, and the guest's through the provider's form
        test.slow();
        const service = await registerService(browser, "owner", "Invited");
        await watchClipboard(page);
        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        const link = await createLink(page);
        expect(link.startsWith(`${baseURL}/invitations#`)).toBe(true);
        const token = link.split("#")[1];
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("row", { name: /Open/ })).toHaveCount(1);

        // a guest opens the link, logs in and comes back to accept it
        const other = await browser.newContext();
        try {
            const otherPage = await other.newPage();
            const problems = watchPage(otherPage, baseURL as string);
            // the token never goes to a server in a URL
            const urls: string[] = [];
            otherPage.on("request", (request) => urls.push(request.url()));
            await otherPage.goto(link);
            await expect(
                otherPage.getByText(
                    "Log in to accept the invitation to a service.",
                ),
            ).toBeVisible();
            // out of the address bar
            await expect(otherPage).toHaveURL(/\/invitations$/);
            await otherPage.getByRole("link", { name: "Log in" }).click();
            await otherPage.getByRole("link", { name: "Mock Login" }).click();
            await otherPage
                .locator("input[name=username]")
                .fill(users.other.sub);
            await otherPage
                .locator("textarea[name=claims], input[name=claims]")
                .fill(JSON.stringify({ name: users.other.name }));
            await otherPage.locator("input[type=submit]").click();
            await otherPage.waitForURL(/\/invitations$/);
            await otherPage
                .getByRole("button", { name: "Accept invitation" })
                .click();
            await expect(
                otherPage.getByText(`You are now maintainer of ${service.id}.`),
            ).toBeVisible();
            expect(urls.filter((url) => url.includes(token))).toEqual([]);

            // the link works once
            await otherPage.goto(link);
            await otherPage
                .getByRole("button", { name: "Accept invitation" })
                .click();
            await expect(
                otherPage.getByText(
                    "This invitation was accepted already. If you accepted it, the service is in your services; otherwise ask the owner of the service for a new one.",
                ),
            ).toBeVisible();
            // Chromium logs the 409 that the page shows, Firefox doesn't
            expect(
                problems.filter((val) => !val.includes("status of 409")),
            ).toEqual([]);
        } finally {
            await other.close();
        }

        // the invitation is gone from the list: the person has the role
        await page.reload();
        await openInvitations(page);
        await expect(dialog.getByText("No open invitations.")).toBeVisible();
        await expect(
            dialog.getByRole("tab", { name: "Invitations 0" }),
        ).toBeVisible();
        await expect(dialog.getByText("Show accepted")).toHaveCount(0);
        await expect(dialog.getByText("Accepted")).toHaveCount(0);
        await dialog.getByRole("tab", { name: "Current Access" }).click();
        await expect(
            dialog.getByRole("row", { name: new RegExp(users.other.name) }),
        ).toContainText(users.other.sub);
    });

    test("owners revoke open invitations", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "Revoked");
        await watchClipboard(page);
        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        const token = (await createLink(page)).split("#")[1];
        const dialog = page.getByRole("dialog");
        await dialog
            .getByRole("button", { name: /^Revoke maintainer invitation/ })
            .click();
        await expect(
            page.getByText("Revoked the maintainer invitation"),
        ).toBeVisible();
        await expect(dialog.getByText("No open invitations.")).toBeVisible();
        // its link goes with it
        await expect(copyButtons(page)).toHaveCount(0);

        const accepted = await api(
            await tokenOf(browser, "other"),
            "POST",
            "/invitations/accept",
            { token },
        );
        expect(accepted.status).toBe(404);
    });

    test("links stay while the dialog is open, and can be renewed", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Relinked");
        await watchClipboard(page);
        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        const first = await createLink(page);
        const second = await createLink(page);
        const dialog = page.getByRole("dialog");
        const note = dialog.getByText(/Links aren.t kept/);
        await expect(note).toBeVisible();
        // there is no second list of links
        await expect(dialog.getByRole("textbox")).toHaveCount(0);
        await expect(
            dialog.getByRole("list", { name: "New invitation links" }),
        ).toHaveCount(0);
        await expect(
            dialog.getByRole("tab", { name: "Invitations 2" }),
        ).toBeVisible();

        // the links stay while switching tabs; each row copies its own,
        // newest first
        await dialog.getByRole("tab", { name: "Current Access" }).click();
        await expect(note).toBeHidden();
        await dialog.getByRole("tab", { name: /^Invitations/ }).click();
        await expect(copyButtons(page)).toHaveCount(2);
        expect(await copyLink(page)).toBe(second);
        await copyButtons(page).nth(1).click();
        await expect
            .poll(() =>
                page.locator("html").evaluate((el) => el.dataset.copied),
            )
            .toBe(first);

        // once the dialog was closed, the links are gone: the open
        // invitations get new ones
        await page.reload();
        await openInvitations(page);
        await expect(
            dialog.getByRole("tab", { name: "Invitations 2" }),
        ).toBeVisible();
        await expect(note).toBeVisible();
        await expect(copyButtons(page)).toHaveCount(0);
        const renew = dialog.getByRole("button", { name: /^New link for / });
        await expect(renew).toHaveCount(2);
        // the older of the two, which is `first`
        await renew.nth(1).click();
        await expect(
            page.getByText(
                "Created a new maintainer link; the old one no longer works",
            ),
        ).toBeVisible();
        // the new invitation is on top, the other one below it
        await expect(copyButtons(page)).toHaveCount(1);
        await expect(
            invitationRows(page)
                .first()
                .getByRole("button", {
                    name: /^Copy link of /,
                }),
        ).toBeVisible();
        await expect(renew).toHaveCount(1);
        await expect(
            dialog.getByRole("tab", { name: "Invitations 2" }),
        ).toBeVisible();
        const renewed = await copyLink(page);

        // the first link no longer works; the renewed one does
        const token = await tokenOf(browser, "other");
        const accept = (link: string) =>
            api(token, "POST", "/invitations/accept", {
                token: link.split("#")[1],
            });
        expect((await accept(first)).status).toBe(404);
        expect((await accept(renewed)).status).toBe(200);
    });

    test("long lists page, newest first", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "Paged");
        await watchClipboard(page);
        const token = await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        const roleOf = (idx: number) => (idx === 0 ? "owner" : "maintainer");
        for (let idx = 0; idx < 7; idx++)
            expect(
                (await api(token, "POST", path, { role: roleOf(idx) })).status,
            ).toBe(201);
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        await expect(
            dialog.getByRole("tab", { name: "Invitations 7" }),
        ).toBeVisible();
        await expect(invitationRows(page)).toHaveCount(5);
        // the oldest invitation, the only one for owners, is last
        await expect(dialog.getByRole("row", { name: /owner/ })).toHaveCount(0);
        await dialog.getByRole("link", { name: "2" }).click();
        await expect(invitationRows(page)).toHaveCount(2);
        await expect(invitationRows(page).last()).toContainText("owner");

        // a new link is on top: back on the first page, to copy it
        await dialog.getByRole("button", { name: "Create link" }).click();
        await expect(copyButtons(page)).toHaveCount(1);
        await expect(invitationRows(page)).toHaveCount(5);
        await expect(
            invitationRows(page)
                .first()
                .getByRole("button", {
                    name: /^Copy link of /,
                }),
        ).toBeVisible();
        await copyLink(page);
        await expect(
            dialog.getByRole("tab", { name: "Invitations 8" }),
        ).toBeVisible();
    });

    test("the limit of invitations is reported, and keeps the old link", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "Limited");
        const token = await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        expect(
            (await api(token, "POST", path, { role: "maintainer" })).status,
        ).toBe(201);
        // a registry whose limit is reached: new invitations fail with the
        // code, which the browser logs
        await page.route(`${registry}${path}`, (route) =>
            route.request().method() === "POST"
                ? route.fulfill({
                      status: 409,
                      contentType: "application/problem+json",
                      headers: { "Access-Control-Allow-Origin": "*" },
                      body: JSON.stringify({
                          title: "Conflict",
                          detail: "This service has as many invitations as allowed.",
                          code: "invitations-limit",
                      }),
                  })
                : route.fallback(),
        );
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: "Create link" }).click();
        await expect(
            page.getByText(
                "This service has reached its limit of invitations, which also counts accepted ones until they expire. Revoke open invitations, or wait until invitations expire.",
            ),
        ).toBeVisible();

        await dialog.getByRole("button", { name: /^New link for / }).click();
        await expect(
            page.getByText(
                "This service has reached its limit of invitations: no new link was created, and the old one still works. Revoke this invitation, then create a new link.",
            ),
        ).toBeVisible();
        await expect(invitationRows(page)).toHaveCount(1);
        await expect(
            dialog.getByRole("button", { name: /^New link for / }),
        ).toBeEnabled();
        const listed = await api(token, "GET", path);
        expect(listed.body).toHaveLength(1);
        // Chromium logs the 409s that the page reports, Firefox doesn't
        expect(
            problems.filter((val) => !val.includes("status of 409")),
        ).toEqual([]);
        problems.length = 0;
    });

    test("a link stays available if the list can't be loaded", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "Unlisted");
        await watchClipboard(page);
        await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        // two links, one of which is revoked while the list fails
        await createLink(page);
        await page.route(`${registry}${path}`, (route) =>
            route.request().method() === "GET"
                ? route.fulfill({
                      status: 500,
                      contentType: "application/problem+json",
                      headers: { "Access-Control-Allow-Origin": "*" },
                      body: JSON.stringify({ title: "Server error" }),
                  })
                : route.fallback(),
        );
        await dialog.getByRole("button", { name: "Create link" }).click();
        await expect(
            dialog.getByText(
                "Cannot load the invitations. Please try again later.",
            ),
        ).toBeVisible();
        await expect(copyButtons(page)).toHaveCount(2);
        const link = await copyLink(page);
        const accepted = await api(
            await tokenOf(browser, "other"),
            "POST",
            "/invitations/accept",
            { token: link.split("#")[1] },
        );
        expect(accepted.status).toBe(200);
        // without a list, nothing else is acted on
        const revoke = dialog.getByRole("button", { name: /^Revoke / });
        await expect(revoke).toHaveCount(2);
        for (const button of await revoke.all())
            await expect(button).toBeDisabled();
        // the failures on purpose
        expect(problems.filter((val) => !val.includes("500"))).toEqual([]);
        problems.length = 0;
    });

    test("revoked links aren't offered if the list can't be loaded", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "Dropped");
        await watchClipboard(page);
        await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        await page.goto(`/dashboard/services/view/${service.id}`);
        await createLink(page);
        await createLink(page);
        const dialog = page.getByRole("dialog");
        await page.route(`${registry}${path}`, (route) =>
            route.request().method() === "GET"
                ? route.fulfill({
                      status: 500,
                      contentType: "application/problem+json",
                      headers: { "Access-Control-Allow-Origin": "*" },
                      body: JSON.stringify({ title: "Server error" }),
                  })
                : route.fallback(),
        );
        await dialog
            .getByRole("button", { name: /^Revoke / })
            .first()
            .click();
        await expect(
            dialog.getByText(
                "Cannot load the invitations. Please try again later.",
            ),
        ).toBeVisible();
        await expect(copyButtons(page)).toHaveCount(1);
        // the failures on purpose
        expect(problems.filter((val) => !val.includes("500"))).toEqual([]);
        problems.length = 0;
    });

    test("a link that can't be copied can be selected", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Uncopied");
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "clipboard", {
                value: {
                    writeText: () => Promise.reject(new Error("denied")),
                },
            });
        });
        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: "Create link" }).click();
        await copyButtons(page).first().click();
        await expect(
            page.getByText("Cannot copy the link; select and copy it."),
        ).toBeVisible();
        await expect(
            dialog.getByRole("textbox", { name: "Invitation link" }),
        ).toHaveValue(/\/invitations#[\w-]{43}$/);
        // selected, to copy it
        await expect(
            dialog.getByRole("textbox", { name: "Invitation link" }),
        ).toBeFocused();
        // gone with the next change
        await dialog.getByRole("button", { name: "Create link" }).click();
        await expect(dialog.getByRole("textbox")).toHaveCount(0);
        await expect(copyButtons(page)).toHaveCount(2);
        // and with the invitation
        await copyButtons(page).first().click();
        await expect(dialog.getByRole("textbox")).toHaveCount(1);
        await dialog
            .getByRole("button", { name: /^Revoke / })
            .first()
            .click();
        await expect(dialog.getByRole("textbox")).toHaveCount(0);
    });

    test("both tabs fit a laptop's window without scrolling", async ({
        page,
        browser,
    }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        const service = await registerService(browser, "owner", "Fitted");
        await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}`;
        // the longest lists: with pages and, for users and groups, a search;
        // named users take two lines. The real entries would need the time
        // of many requests, and names only come with logins
        await page.route(`${registry}${path}/permissions`, async (route) => {
            if (route.request().method() !== "GET") return route.fallback();
            const response = await route.fetch();
            await route.fulfill({
                response,
                json: Array.from({ length: 12 }, (_, idx) => ({
                    user_id: `member-${idx}@lifescience-ri.eu`,
                    name: `Member ${idx}`,
                    role: idx ? "maintainer" : "owner",
                })),
            });
        });
        await page.route(`${registry}${path}/invitations`, async (route) => {
            if (route.request().method() !== "GET") return route.fallback();
            const response = await route.fetch();
            await route.fulfill({
                response,
                json: Array.from({ length: 12 }, (_, idx) => ({
                    id: `invitation-${idx}`,
                    service_id: service.id,
                    role: "maintainer",
                    created_by: users.owner.sub,
                    created_at: `2026-11-01T${String(idx).padStart(2, "0")}:00:00Z`,
                    expires_at: "2099-11-08T00:00:00Z",
                })),
            });
        });
        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("button", { name: "Manage access" }).click();
        const dialog = page.getByRole("dialog");
        const fits = async () => {
            const { scrollHeight, clientHeight } = await dialog.evaluate(
                (el) => ({
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                }),
            );
            expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
        };

        await expect(
            dialog.getByRole("button", { name: /^Remove / }),
        ).toHaveCount(5);
        await expect(dialog.getByRole("link", { name: "2" })).toBeVisible();
        await expect(
            dialog.getByRole("searchbox", { name: "Search users and groups" }),
        ).toBeVisible();
        await expect(
            dialog.getByRole("button", { name: "Grant" }),
        ).toBeVisible();
        await fits();

        await dialog.getByRole("tab", { name: "Invitations 12" }).click();
        await expect(invitationRows(page)).toHaveCount(5);
        await expect(dialog.getByRole("link", { name: "2" })).toBeVisible();
        await fits();
    });

    test("pages without an invitation say so", async ({ page }) => {
        await page.goto("/invitations#short");
        await expect(page.getByText("No invitation to accept")).toBeVisible();
    });
});
