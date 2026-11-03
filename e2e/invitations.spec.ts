import type { Page } from "@playwright/test";
import type { Invitation } from "../src/lib/cloud-registry.types";
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
        .filter({
            has: page.getByRole("button", { name: /^(Revoke|Remove) / }),
        });

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
 * Ask for a new link in the "Manage access" dialog of a service
 * @param page Page of the service, with the dialog at its invitations
 * @param label Label of the invitation
 */
async function requestLink(page: Page, label = "A colleague") {
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Label/).fill(label);
    await dialog.getByRole("button", { name: "Create link" }).click();
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
    await requestLink(page);
    await expect(copyButtons(page)).toHaveCount(before + 1);
    return copyLink(page);
}

/**
 * Set a public setting for a page, as the deployment would
 * @param page Page, before it opens the app
 * @param name Name of the setting
 * @param value Its value
 */
async function setPublicSetting(page: Page, name: string, value: string) {
    await page.addInitScript(
        ([key, val]) => {
            let settings: Record<string, string> | undefined;
            Object.defineProperty(window, "__PUBLIC_SETTINGS__", {
                get: () => settings,
                set: (given: Record<string, string>) => {
                    settings = { ...given, [key]: val };
                },
            });
        },
        [name, value],
    );
}

/**
 * Check that long labels are clipped, and that the badges of their rows stay
 * in their cells, where the column after them starts
 * @param page Page that shows the invitations
 */
async function expectLabelsClipped(page: Page) {
    const rows = invitationRows(page);
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let idx = 0; idx < count; idx++) {
        const cell = rows.nth(idx).getByRole("cell").first();
        const measured = await cell.evaluate((el) => {
            const label = el.querySelector("[title]") as HTMLElement;
            const { left, right } = el.getBoundingClientRect();
            return {
                clipped: label.scrollWidth > label.clientWidth,
                badges: Array.from(
                    el.querySelectorAll('[data-slot="badge"]'),
                    (badge) => {
                        const box = badge.getBoundingClientRect();
                        return Math.max(left - box.left, box.right - right);
                    },
                ),
            };
        });
        expect(measured.clipped).toBe(true);
        expect(measured.badges.length).toBeGreaterThan(0);
        for (const overlap of measured.badges)
            expect(overlap).toBeLessThanOrEqual(0);
    }
}

/**
 * Change what the registry lists for a page, e.g. as the time passed
 * @param page Page, before it loads the list
 * @param path Path of the invitations of the service
 * @param change Gets the list from the registry, and returns the one to show
 */
async function changeListed(
    page: Page,
    path: string,
    change: (listed: Invitation[]) => Invitation[],
) {
    await page.route(`${registry}${path}`, async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        const response = await route.fetch();
        await route.fulfill({
            response,
            json: change(await response.json()),
        });
    });
}

/**
 * Let invitations seem expired: no setting of the registry expires them
 * within a test, and it removes those that it has listed as expired with
 * the same request as any others
 * @param ids Identifiers of the invitations
 * @returns The change of the list, for `changeListed()`
 */
const expire =
    (ids: Set<string>) =>
    (listed: Invitation[]): Invitation[] =>
        listed.map((val) =>
            ids.has(val.id)
                ? {
                      ...val,
                      status: "expired",
                      expires_at: "2026-10-01T00:00:00.000Z",
                  }
                : val,
        );

/**
 * Create invitations through the API
 * @param token Access token of an owner
 * @param path Path of the invitations of the service
 * @param labels Their labels
 * @returns Their identifiers
 */
async function createInvitations(
    token: string,
    path: string,
    labels: string[],
) {
    const ids: string[] = [];
    for (const label of labels) {
        const { status, body } = await api(token, "POST", path, {
            role: "maintainer",
            label,
        });
        expect(status).toBe(201);
        ids.push((body as Invitation).id);
    }
    return ids;
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
        await expect(invitationRows(page)).toHaveCount(1);

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
        await expect(
            dialog.getByRole("textbox", { name: "Invitation link" }),
        ).toHaveCount(0);
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
        await requestLink(page);
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
        await requestLink(page);
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
        await requestLink(page);
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
        await requestLink(page);
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
        await requestLink(page);
        await expect(
            dialog.getByRole("textbox", { name: "Invitation link" }),
        ).toHaveCount(0);
        await expect(copyButtons(page)).toHaveCount(2);
        // and with the invitation
        await copyButtons(page).first().click();
        await expect(
            dialog.getByRole("textbox", { name: "Invitation link" }),
        ).toHaveCount(1);
        await dialog
            .getByRole("button", { name: /^Revoke / })
            .first()
            .click();
        await expect(
            dialog.getByRole("textbox", { name: "Invitation link" }),
        ).toHaveCount(0);
    });

    test("a late failure to copy doesn't bring back the field", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Late");
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "clipboard", {
                value: {
                    writeText: () =>
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("denied")), 2000),
                        ),
                },
            });
        });
        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        await requestLink(page);
        await copyButtons(page).first().click();
        // a change while the browser is still copying
        await requestLink(page);
        await expect(copyButtons(page)).toHaveCount(2);
        await expect(
            page.getByText("Cannot copy the link; select and copy it."),
        ).toBeVisible();
        await expect(
            dialog.getByRole("textbox", { name: "Invitation link" }),
        ).toHaveCount(0);
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
                json: [
                    {
                        user_id: `${"long-id-".repeat(13)}@lifescience-ri.eu`,
                        name: "Long Name ".repeat(13),
                        role: "owner",
                    },
                    {
                        user_id: `${"unnamed-".repeat(13)}@lifescience-ri.eu`,
                        role: "maintainer",
                    },
                    {
                        group: `urn:${"long-group:".repeat(13)}`,
                        role: "maintainer",
                    },
                    ...Array.from({ length: 9 }, (_, idx) => ({
                        user_id: `member-${idx}@lifescience-ri.eu`,
                        name: `Member ${idx}`,
                        role: "maintainer",
                    })),
                ],
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
                    // the longest labels stay on one line
                    label: "x".repeat(100),
                    status: idx % 2 ? "expired" : "open",
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
        // whatever the length of names, IDs and groups, the role and the
        // remove button stay on the row's other cells
        const holderCells = dialog
            .getByRole("table")
            .first()
            .locator("tbody tr td:first-child");
        await expect(holderCells).toHaveCount(5);
        const overflows = await holderCells.evaluateAll((cells) =>
            cells.flatMap((cell) => {
                const right = cell.getBoundingClientRect().right;
                return Array.from(cell.querySelectorAll("*"))
                    .filter(
                        (el) =>
                            el.getBoundingClientRect().right > right ||
                            // text that paints outside its box
                            (el.scrollWidth > el.clientWidth &&
                                getComputedStyle(el).overflowX === "visible"),
                    )
                    .map((el) => el.textContent);
            }),
        );
        expect(overflows).toEqual([]);

        await dialog.getByRole("tab", { name: "Invitations 6" }).click();
        await expect(invitationRows(page)).toHaveCount(5);
        await expect(dialog.getByRole("link", { name: "2" })).toBeVisible();
        await expect(
            dialog.getByRole("button", { name: "Remove expired" }),
        ).toBeVisible();
        await fits();
        await expectLabelsClipped(page);
    });

    test("long labels stay in their cell at phone width", async ({
        page,
        browser,
    }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        const service = await registerService(browser, "owner", "Narrow");
        await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        await page.route(`${registry}${path}`, async (route) => {
            if (route.request().method() !== "GET") return route.fallback();
            const response = await route.fetch();
            await route.fulfill({
                response,
                json: [false, true].map((expired, idx) => ({
                    id: `invitation-${idx}`,
                    service_id: service.id,
                    role: "maintainer",
                    label: "x".repeat(100),
                    status: expired ? "expired" : "open",
                    created_by: users.owner.sub,
                    created_at: "2026-11-01T00:00:00Z",
                    expires_at: expired
                        ? "2026-11-02T00:00:00Z"
                        : "2099-11-08T00:00:00Z",
                })),
            });
        });
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        await expect(invitationRows(page)).toHaveCount(2);
        await expectLabelsClipped(page);
        // the column's dates move into the first cell; nothing scrolls sideways
        const dialog = page.getByRole("dialog");
        await expect(
            dialog.getByRole("columnheader", { name: "Expires" }),
        ).toBeHidden();
        await expect(invitationRows(page).first()).toContainText("expires");
        const wrapper = invitationRows(page)
            .first()
            .locator('xpath=ancestor::*[@data-slot="table-container"]');
        const scroll = await wrapper.evaluate((el) => ({
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
        }));
        expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
    });

    test("the deployment sets the entries per page", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Paged");
        await setPublicSetting(page, "NEXT_PUBLIC_ACCESS_PAGE_SIZE", "2");
        await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}`;
        await page.route(`${registry}${path}/invitations`, async (route) => {
            if (route.request().method() !== "GET") return route.fallback();
            const response = await route.fetch();
            await route.fulfill({
                response,
                json: Array.from({ length: 3 }, (_, idx) => ({
                    id: `invitation-${idx}`,
                    service_id: service.id,
                    role: "maintainer",
                    label: `Label ${idx}`,
                    status: "open",
                    created_by: users.owner.sub,
                    created_at: `2026-11-01T0${idx}:00:00Z`,
                    expires_at: "2099-11-08T00:00:00Z",
                })),
            });
        });
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        await expect(invitationRows(page)).toHaveCount(2);
        await expect(
            page.getByRole("dialog").getByRole("link", { name: "2" }),
        ).toBeVisible();
    });

    test("an invitation accepted meanwhile shows under Current Access", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Meanwhile");
        const owner = await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("button", { name: "Manage access" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("table").first()).toBeVisible();
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        const created = await api(owner, "POST", path, { role: "maintainer" });
        const accepted = await api(
            await tokenOf(browser, "other"),
            "POST",
            "/invitations/accept",
            { token: created.body.token },
        );
        expect(accepted.status).toBe(200);
        await expect(dialog.getByText(users.other.sub)).toHaveCount(0);

        await dialog.getByRole("tab", { name: /^Invitations/ }).click();
        await dialog.getByRole("tab", { name: "Current Access" }).click();
        await expect(dialog.getByText(users.other.sub)).toBeVisible();
    });

    test("labels name the invitations", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "Labelled");
        await watchClipboard(page);
        const token = await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        const create = dialog.getByRole("button", { name: "Create link" });
        const label = dialog.getByLabel("Label", { exact: true });

        // required by default
        await create.click();
        await expect(dialog.getByText("Label is required.")).toBeVisible();
        await expect(label).toBeFocused();
        await expect(invitationRows(page)).toHaveCount(0);
        // refused as the registry would, without asking it
        await label.fill("x".repeat(101));
        await expect(dialog.getByText("Label is required.")).toHaveCount(0);
        await create.click();
        await expect(
            dialog.getByText("Label can't be longer than 100 characters."),
        ).toBeVisible();
        await label.fill("Bob\u202E");
        await create.click();
        await expect(
            dialog.getByText(
                "Label can't contain control or direction-changing characters.",
            ),
        ).toBeVisible();
        await expect(invitationRows(page)).toHaveCount(0);

        // the main text of the row, as text; whitespace around it is dropped,
        // and the field is empty for the next one
        await requestLink(page, "  <b>Bob</b> (variant calling)  ");
        await expect(invitationRows(page)).toHaveCount(1);
        await expect(invitationRows(page).first()).toContainText(
            "<b>Bob</b> (variant calling)",
        );
        await expect(label).toHaveValue("");
        const listed = await api(token, "GET", path);
        expect(listed.body).toEqual([
            expect.objectContaining({
                label: "<b>Bob</b> (variant calling)",
                status: "open",
            }),
        ]);

        // also after a reload, and a new link keeps it
        await page.reload();
        await openInvitations(page);
        await dialog.getByRole("button", { name: /^New link for / }).click();
        await expect(copyButtons(page)).toHaveCount(1);
        await expect(invitationRows(page).first()).toContainText(
            "<b>Bob</b> (variant calling)",
        );
        const renewed = await api(token, "GET", path);
        expect(renewed.body).toHaveLength(1);
        expect((renewed.body as Invitation[])[0].label).toBe(
            "<b>Bob</b> (variant calling)",
        );
    });

    test("the deployment can make the label optional", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Unlabelled");
        await setPublicSetting(
            page,
            "NEXT_PUBLIC_INVITATION_LABEL_REQUIRED",
            "false",
        );
        await watchClipboard(page);
        const token = await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByLabel("Label (optional)")).toBeVisible();
        await dialog.getByRole("button", { name: "Create link" }).click();
        await expect(copyButtons(page)).toHaveCount(1);
        await expect(invitationRows(page).first()).toContainText("No label");
        // italics lean out of their box: the last letter stays
        const noLabel = invitationRows(page).first().getByText("No label");
        expect(
            await noLabel.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        const listed = await api(token, "GET", path);
        expect((listed.body as Invitation[])[0].label).toBeUndefined();
    });

    test("expired invitations are marked, and get a new link or are removed", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Expired");
        await watchClipboard(page);
        const token = await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        const [renewed, removed] = await createInvitations(token, path, [
            "To renew",
            "To remove",
            "Still open",
        ]);
        await changeListed(page, path, expire(new Set([renewed, removed])));
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        // only the open one counts
        await expect(
            dialog.getByRole("tab", { name: "Invitations 1" }),
        ).toBeVisible();
        const row = (label: string) =>
            invitationRows(page).filter({ hasText: label });
        await expect(invitationRows(page)).toHaveCount(3);
        for (const label of ["To renew", "To remove"]) {
            await expect(row(label)).toContainText("Expired");
            await expect(
                row(label).getByRole("button", { name: /^Remove / }),
            ).toBeVisible();
            await expect(
                row(label).getByRole("button", { name: /^Revoke / }),
            ).toHaveCount(0);
            await expect(
                row(label).getByRole("button", { name: /^New link for / }),
            ).toHaveAttribute("title", "New link (removes this one)");
        }
        await expect(row("Still open")).not.toContainText("Expired");
        await expect(
            row("Still open").getByRole("button", { name: /^Revoke / }),
        ).toBeVisible();

        // a new link: a new open invitation with the same label, on top
        await row("To renew")
            .getByRole("button", { name: /^New link for / })
            .click();
        await expect(
            page.getByText(
                "Created a new maintainer link and removed the expired invitation",
            ),
        ).toBeVisible();
        await expect(copyButtons(page)).toHaveCount(1);
        await expect(invitationRows(page).first()).toContainText("To renew");
        await expect(invitationRows(page).first()).not.toContainText("Expired");
        await expect(
            dialog.getByRole("tab", { name: "Invitations 2" }),
        ).toBeVisible();
        const link = await copyLink(page);
        const accepted = await api(
            await tokenOf(browser, "other"),
            "POST",
            "/invitations/accept",
            { token: link.split("#")[1] },
        );
        expect(accepted.status).toBe(200);

        // removed: gone from the list and from the registry
        await row("To remove")
            .getByRole("button", { name: /^Remove / })
            .click();
        await expect(
            page.getByText("Removed the expired maintainer invitation"),
        ).toBeVisible();
        await expect(row("To remove")).toHaveCount(0);
        const listed = (await api(token, "GET", path)).body as Invitation[];
        expect(listed.map((val) => val.label)).toEqual(["Still open"]);
    });

    test("all expired invitations can be removed at once", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "Tidied");
        const token = await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        // on two pages
        const labels = ["A", "B", "C", "D", "E", "F", "Stuck"];
        const expired = await createInvitations(token, path, labels);
        const stuck = expired[expired.length - 1];
        await createInvitations(token, path, ["Still open"]);
        await changeListed(page, path, expire(new Set(expired)));
        // a request that fails doesn't stop the others
        const failing = `${registry}${path}/${stuck}`;
        await page.route(failing, (route) =>
            route.fulfill({
                status: 500,
                contentType: "application/problem+json",
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ title: "Server error" }),
            }),
        );
        const deletes: string[] = [];
        page.on("request", (request) => {
            if (request.method() === "DELETE") deletes.push(request.url());
        });
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");
        const button = dialog.getByRole("button", { name: "Remove expired" });
        const confirm = page.getByRole("alertdialog");

        // nothing happens without the confirmation
        await button.click();
        await expect(confirm).toContainText("All 7 expired invitations");
        await confirm.getByRole("button", { name: "Cancel" }).click();
        await expect(confirm).toBeHidden();
        expect(deletes).toEqual([]);
        await expect(invitationRows(page)).toHaveCount(5);

        await button.click();
        await confirm.getByRole("button", { name: "Remove" }).click();
        await expect(
            page.getByText(
                "Cannot remove 1 of 7 expired invitations (Stuck): Cannot remove the invitation currently.",
            ),
        ).toBeVisible();
        expect(deletes).toHaveLength(7);
        expect(new Set(deletes).size).toBe(7);
        // what stays is listed, and the open one is left alone
        await expect(invitationRows(page)).toHaveCount(2);
        await expect(
            invitationRows(page).filter({ hasText: "Stuck" }),
        ).toContainText("Expired");
        await expect(
            dialog.getByRole("tab", { name: "Invitations 1" }),
        ).toBeVisible();
        const listed = (await api(token, "GET", path)).body as Invitation[];
        expect(listed.map((val) => val.label)).toEqual(["Stuck", "Still open"]);

        // it can be tried again; without expired ones, the button is gone
        await page.unroute(failing);
        await button.click();
        await expect(confirm).toContainText("The expired invitation");
        await confirm.getByRole("button", { name: "Remove" }).click();
        await expect(
            page.getByText("Removed the expired invitation"),
        ).toBeVisible();
        await expect(invitationRows(page)).toHaveCount(1);
        await expect(button).toHaveCount(0);
        // Chromium logs the failure on purpose
        expect(problems.filter((val) => !val.includes("500"))).toEqual([]);
        problems.length = 0;
    });

    test("registries without labels and status still work", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "Older");
        await watchClipboard(page);
        const token = await login(page, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/invitations`;
        const [late] = await createInvitations(token, path, ["Past"]);
        const [taken] = await createInvitations(token, path, ["Taken"]);
        // as cloud-registry 1.0.0rc1 lists them: without both fields, and
        // with accepted ones; it also refuses labels as unknown fields
        await changeListed(page, path, (listed) =>
            listed.map(({ status: _status, label: _label, ...val }) => ({
                ...val,
                ...(val.id === taken && {
                    accepted: {
                        user_id: users.other.sub,
                        accepted_at: "2026-11-02T00:00:00.000Z",
                    },
                }),
                ...(val.id === late && {
                    expires_at: "2026-10-01T00:00:00.000Z",
                }),
            })),
        );
        await page.route(`${registry}${path}`, (route) => {
            const request = route.request();
            return request.method() === "POST" && request.postDataJSON().label
                ? route.fulfill({
                      status: 400,
                      contentType: "application/problem+json",
                      headers: { "Access-Control-Allow-Origin": "*" },
                      body: JSON.stringify({
                          title: "Bad request",
                          detail: "Additional properties are not allowed ('label' was unexpected)",
                          status: 400,
                      }),
                  })
                : route.fallback();
        });
        await page.goto(`/dashboard/services/view/${service.id}`);
        await openInvitations(page);
        const dialog = page.getByRole("dialog");

        // the accepted one is hidden; the other one is open, as such a
        // registry lists no expired ones and the browser's clock may be off
        await expect(invitationRows(page)).toHaveCount(1);
        await expect(invitationRows(page).first()).toContainText("No label");
        await expect(invitationRows(page).first()).not.toContainText("Expired");
        await expect(
            dialog.getByRole("button", { name: "Remove expired" }),
        ).toHaveCount(0);
        await expect(
            dialog.getByRole("tab", { name: "Invitations 1" }),
        ).toBeVisible();

        // a link without the label, rather than none
        await requestLink(page, "Bob");
        await expect(
            page.getByText(
                "Created a maintainer link without its label, as this registry has no labels; copy it before you close this dialog",
            ),
        ).toBeVisible();
        await expect(
            page.getByText(
                "This registry is too old for this version of the app: don't change the roles of users until its admins upgrade it.",
            ),
        ).toBeVisible();
        await expect(copyButtons(page)).toHaveCount(1);
        await expect(invitationRows(page).first()).toContainText("No label");
        await expect(
            dialog.getByRole("tab", { name: "Invitations 2" }),
        ).toBeVisible();
        // Chromium logs the 400 that the app handles
        expect(
            problems.filter((val) => !val.includes("status of 400")),
        ).toEqual([]);
        problems.length = 0;
    });

    test("pages without an invitation say so", async ({ page }) => {
        await page.goto("/invitations#short");
        await expect(page.getByText("No invitation to accept")).toBeVisible();
    });
});
