import type { Page } from "@playwright/test";
import {
    expect,
    login,
    registerService,
    registry,
    test,
    users,
} from "./fixtures";

/**
 * Open a service's page, once the app knows the user's roles
 * @param page Page, logged in
 * @param id ID of the service
 */
async function openService(page: Page, id: string) {
    await page.goto(`/dashboard/services/view/${id}`);
    await page.waitForLoadState("networkidle");
}

test.describe("admin mode", () => {
    test("admins start in user mode and switch to admin mode and back", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Moded");
        await login(page, "admin");
        const userMode = page.getByRole("button", { name: "User mode" });
        const adminMode = page.getByRole("button", { name: "Admin mode" });
        const verify = page.getByRole("button", { name: "Verify" });

        // the rights of other users: no admin actions on others' services
        await openService(page, service.id);
        await expect(userMode).toBeVisible();
        await expect(userMode).toHaveAttribute("aria-pressed", "false");
        await expect(verify).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

        await userMode.click();
        await expect(adminMode).toBeVisible();
        await expect(adminMode).toHaveAttribute("aria-pressed", "true");
        await expect(verify).toBeVisible();
        await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();

        // kept on reloads
        await page.reload();
        await expect(adminMode).toBeVisible();
        await expect(verify).toBeVisible();

        await adminMode.click();
        await expect(userMode).toBeVisible();
        await expect(verify).toHaveCount(0);
    });

    test("admins leave admin mode also without admin rights", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Stripped");
        await login(page, "admin", { adminMode: true });
        // e.g. a proxy that drops the header
        await page.route(`${registry}/**`, (route) => {
            const headers = { ...route.request().headers() };
            delete headers["x-request-roles"];
            return route.continue({ headers });
        });
        await openService(page, service.id);
        const adminMode = page.getByRole("button", { name: "Admin mode" });
        await expect(adminMode).toBeVisible();
        await expect(page.getByRole("button", { name: "Verify" })).toHaveCount(
            0,
        );
        await adminMode.hover();
        await expect(
            page.getByRole("tooltip").filter({
                hasText: "Admin rights don't apply right now.",
            }),
        ).toBeVisible();
        await adminMode.click();
        await expect(
            page.getByRole("button", { name: "User mode" }),
        ).toBeVisible();
    });

    test("a new login starts in user mode", async ({ page }) => {
        await login(page, "admin", { adminMode: true });
        await page.getByRole("button", { name: users.admin.sub }).click();
        await page.getByRole("menuitem", { name: "Log out" }).click();
        await page.waitForURL(/\/auth\/login/);
        const names = (await page.context().cookies()).map((val) => val.name);
        expect(names).not.toContain("admin_mode");

        // also if the mode is left over, e.g. after the session expired
        await page.context().addCookies([
            {
                name: "admin_mode",
                value: "1",
                domain: new URL(page.url()).hostname,
                path: "/",
            },
        ]);
        await login(page, "admin");
        await expect(
            page.getByRole("button", { name: "User mode" }),
        ).toBeVisible();
        const after = (await page.context().cookies()).map((val) => val.name);
        expect(after).not.toContain("admin_mode");
    });

    test("other users and guests see no switch", async ({ page }) => {
        await page.goto("/dashboard/services");
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
        await expect(
            page.getByRole("button", { name: /User mode|Admin mode/ }),
        ).toHaveCount(0);

        await login(page, "owner");
        await page.goto("/dashboard/services");
        await page.waitForLoadState("networkidle");
        await expect(
            page.getByRole("button", { name: /User mode|Admin mode/ }),
        ).toHaveCount(0);
    });
});
