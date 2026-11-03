import type { Page } from "@playwright/test";
import {
    api,
    expect,
    login,
    registerService,
    test,
    tokenOf,
    uniqueId,
    users,
    watchPage,
} from "./fixtures";

/**
 * Open a service's page and wait until the app knows the user's roles, so
 * that missing controls are missing for the user, not for lack of the roles
 * @param page Page, logged in
 * @param id ID of the service
 */
async function openAsUser(page: Page, id: string) {
    await page.goto(`/dashboard/services/view/${id}`);
    // all requests for the user (`/me`) answered, and rendered since
    await page.waitForLoadState("networkidle");
}

test.describe("services", () => {
    test("owners find, edit and delete their services", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Owned");
        await login(page, "owner");

        await page.goto("/dashboard/services");
        await page.getByLabel("Search services").fill(service.name);
        await page.getByText(service.name, { exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText(service.url);
        await page.keyboard.press("Escape");
        // requests cut off by leaving the page fail, and the app logs them
        await page.waitForLoadState("networkidle");

        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("link", { name: "Edit" }).click();
        await page.waitForURL(/\/update\//);
        const renamed = `${service.name} renamed`;
        await page.locator("input[name=name]").fill(renamed);
        await page.getByRole("button", { name: "Submit" }).click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .body?.name,
            )
            .toBe(renamed);
        await page.waitForLoadState("networkidle");

        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(page.getByText(renamed, { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Delete" }).click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .status,
            )
            .toBe(404);
    });

    test("other users can't change a service", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "Not yours");
        await login(page, "other");
        await openAsUser(page, service.id);
        await expect(
            page.getByText(service.name, { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
        for (const name of ["Delete", "Manage access", "Verify"])
            await expect(page.getByRole("button", { name })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    });

    test("owners give other users roles", async ({
        page,
        browser,
        baseURL,
    }) => {
        const service = await registerService(browser, "owner", "Shared");
        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("button", { name: "Manage access" }).click();
        const dialog = page.getByRole("dialog");
        // the form's defaults: a user, with the maintainer role
        await dialog.getByLabel("User ID").fill(users.other.sub);
        await dialog.getByRole("button", { name: "Grant" }).click();
        await expect(
            page.getByText(`Granted maintainer role to ${users.other.sub}`),
        ).toBeVisible();
        await expect(dialog).toContainText(users.other.sub);

        // maintainers edit, but don't delete or manage access
        const other = await browser.newContext();
        try {
            const otherPage = await other.newPage();
            const problems = watchPage(otherPage, baseURL as string);
            await login(otherPage, "other");
            await openAsUser(otherPage, service.id);
            await expect(
                otherPage.getByRole("link", { name: "Edit" }),
            ).toBeVisible();
            for (const name of ["Delete", "Manage access"])
                await expect(
                    otherPage.getByRole("button", { name }),
                ).toHaveCount(0);
            expect(problems).toEqual([]);
        } finally {
            await other.close();
        }
    });

    test("admins verify services", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "To verify");
        await login(page, "admin", { adminMode: true });
        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("button", { name: "Verify", exact: true }).click();
        await expect(
            page.getByRole("button", { name: "Unverify" }),
        ).toBeVisible();
        expect(
            (
                await api(
                    undefined,
                    "GET",
                    `/services/${service.id}/verification`,
                )
            ).status,
        ).toBe(200);
    });

    test("guests see services without changing them", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Public");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(
            page.getByText(service.name, { exact: true }),
        ).toBeVisible();
        // guests have no roles to wait for
        for (const name of ["Delete", "Manage access", "Verify"])
            await expect(page.getByRole("button", { name })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    });

    test("users filter the services they are responsible for", async ({
        page,
        browser,
    }) => {
        // services of one test run, found by the search
        const run = uniqueId();
        const owned = await registerService(browser, "owner", `Owned ${run}`);
        const maintained = await registerService(
            browser,
            "other",
            `Maintained ${run}`,
        );
        const others = await registerService(browser, "other", `Other ${run}`);
        const granted = await api(
            await tokenOf(browser, "other"),
            "PUT",
            `/services/${maintained.id}/permissions/users/${encodeURIComponent(users.owner.sub)}`,
            { role: "maintainer" },
        );
        expect(granted.status).toBeLessThan(300);

        await login(page, "owner");
        await page.getByLabel("Search services").fill(run);
        const names = [owned, maintained, others].map((val) =>
            page.getByText(val.name, { exact: true }),
        );
        for (const name of names) await expect(name).toBeVisible();
        const mine = page.getByRole("button", {
            name: "Show my services only",
        });
        await mine.click();
        await expect(names[0]).toBeVisible();
        await expect(names[1]).toBeVisible();
        await expect(names[2]).toHaveCount(0);
        // the search still applies, and Clear resets both
        await page.getByLabel("Search services").fill(owned.name);
        await expect(names[0]).toBeVisible();
        await expect(names[1]).toHaveCount(0);
        await page.getByRole("button", { name: "Clear" }).click();
        await expect(mine).toHaveAttribute("aria-pressed", "false");
    });

    test("guests get no filter for their services", async ({ page }) => {
        await page.goto("/dashboard/services");
        // the list has loaded
        await page.waitForLoadState("networkidle");
        await expect(page.getByLabel("Search services")).toBeEnabled();
        await expect(
            page.getByRole("button", { name: "Show my services only" }),
        ).toHaveCount(0);
    });
});
