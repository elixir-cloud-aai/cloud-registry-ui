import type { Page } from "@playwright/test";
import {
    api,
    expect,
    login,
    registerService,
    test,
    tokenOf,
    users,
    watchPage,
} from "./fixtures";

/** The links shown in the "Manage access" dialog, newest first */
const linkBoxes = (page: Page) =>
    page.getByRole("dialog").getByRole("textbox", { name: /^Invitation link/ });

/**
 * Create an invitation link in the "Manage access" dialog of a service
 * @param page Page of the service, logged in as an owner
 * @returns The link
 */
async function createLink(page: Page) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible()))
        await page.getByRole("button", { name: "Manage access" }).click();
    const before = await linkBoxes(page).count();
    await dialog.getByRole("button", { name: "Create link" }).click();
    await expect(linkBoxes(page)).toHaveCount(before + 1);
    const link = await linkBoxes(page).first().inputValue();
    expect(link).toMatch(/\/invitations#[\w-]{43}$/);
    return link;
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

        // the owner sees who accepted, on request, and the new role
        await page.reload();
        await page.getByRole("button", { name: "Manage access" }).click();
        await expect(dialog.getByText("No open invitations.")).toBeVisible();
        await expect(dialog.getByRole("row", { name: /Accepted/ })).toHaveCount(
            0,
        );
        await dialog.getByRole("button", { name: "Show accepted (1)" }).click();
        await expect(
            dialog.getByRole("row", { name: /Accepted/ }),
        ).toContainText(`by ${users.other.name}`);
        await expect(dialog).toContainText(users.other.sub);
        // accepted invitations aren't revoked: the role is
        await expect(
            dialog.getByRole("button", { name: /^Revoke / }),
        ).toHaveCount(0);
    });

    test("owners revoke open invitations", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "Revoked");
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
        await expect(linkBoxes(page)).toHaveCount(0);

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
        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        const first = await createLink(page);
        const second = await createLink(page);
        const dialog = page.getByRole("dialog");
        // both links, newest first, each with a copy button
        await expect(linkBoxes(page).nth(0)).toHaveValue(second);
        await expect(linkBoxes(page).nth(1)).toHaveValue(first);
        await expect(
            dialog.getByRole("button", {
                name: "Copy invitation link for the maintainer role",
            }),
        ).toHaveCount(2);
        await expect(
            dialog.getByRole("button", { name: /^Copy link of / }),
        ).toHaveCount(2);
        await expect(
            dialog.getByText(/Links are shown only while this dialog is open/),
        ).toBeVisible();

        // once the dialog was closed, the links are gone: the open
        // invitations get new ones
        await page.reload();
        await page.getByRole("button", { name: "Manage access" }).click();
        await expect(dialog.getByText("2 open invitations.")).toBeVisible();
        await expect(linkBoxes(page)).toHaveCount(0);
        const renew = dialog.getByRole("button", { name: /^New link for / });
        await expect(renew).toHaveCount(2);
        await renew.first().click();
        await expect(
            page.getByText(
                "Created a new maintainer link; the old one no longer works",
            ),
        ).toBeVisible();
        await expect(linkBoxes(page)).toHaveCount(1);
        const renewed = await linkBoxes(page).first().inputValue();
        await expect(dialog.getByText("2 open invitations.")).toBeVisible();
        await expect(renew).toHaveCount(1);

        // the first link no longer works; the renewed one does
        const token = await tokenOf(browser, "other");
        const accept = (link: string) =>
            api(token, "POST", "/invitations/accept", {
                token: link.split("#")[1],
            });
        expect((await accept(first)).status).toBe(404);
        expect((await accept(renewed)).status).toBe(200);
    });

    test("pages without an invitation say so", async ({ page }) => {
        await page.goto("/invitations#short");
        await expect(page.getByText("No invitation to accept")).toBeVisible();
    });
});
