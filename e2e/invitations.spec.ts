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

/**
 * Create an invitation link in the "Manage access" dialog of a service
 * @param page Page of the service, logged in as an owner
 * @returns The link
 */
async function createLink(page: Page) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible()))
        await page.getByRole("button", { name: "Manage access" }).click();
    await dialog.getByRole("button", { name: "Create link" }).click();
    const link = await dialog
        .getByRole("textbox", { name: "Invitation link" })
        .inputValue();
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
                otherPage.getByText(
                    `You are now maintainer of ${service.id}.`,
                ),
            ).toBeVisible();
            expect(urls.filter((url) => url.includes(token))).toEqual([]);

            // the link works once
            await otherPage.goto(link);
            await otherPage
                .getByRole("button", { name: "Accept invitation" })
                .click();
            await expect(
                otherPage.getByText(
                    "This invitation was accepted already. Ask the owner of the service for a new one.",
                ),
            ).toBeVisible();
            // the browser logs the 409 that the page shows
            expect(problems).toEqual([
                expect.stringContaining("status of 409"),
            ]);
        } finally {
            await other.close();
        }

        // the owner sees who accepted, and the new role
        await page.reload();
        await page.getByRole("button", { name: "Manage access" }).click();
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
        await expect(
            dialog.getByText("No open or accepted invitations."),
        ).toBeVisible();

        const accepted = await api(
            await tokenOf(browser, "other"),
            "POST",
            "/invitations/accept",
            { token },
        );
        expect(accepted.status).toBe(404);
    });

    test("pages without an invitation say so", async ({ page }) => {
        await page.goto("/invitations#short");
        await expect(page.getByText("No invitation to accept")).toBeVisible();
    });
});
