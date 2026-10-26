import { expect, login, test, users } from "./fixtures";

test.describe("login", () => {
    test("sets the security headers", async ({ page }) => {
        const response = await page.goto("/auth/login");
        const headers = response?.headers() ?? {};
        expect(headers["content-security-policy"]).toContain(
            "frame-ancestors 'none'",
        );
        expect(headers["content-security-policy"]).toContain(
            "connect-src 'self' http://localhost:8180",
        );
        expect(headers["x-frame-options"]).toBe("DENY");
        expect(headers["x-content-type-options"]).toBe("nosniff");
        expect(headers["x-powered-by"]).toBeUndefined();
    });

    test("logs in, keeps the session and logs out", async ({ page }) => {
        await login(page, "owner");
        const menu = page.getByRole("button", { name: users.owner.sub });
        await expect(menu).toContainText(users.owner.name);

        const session = (await page.context().cookies()).find(
            (val) => val.name === "id_token",
        );
        expect(session?.httpOnly).toBe(true);
        await page.reload();
        await expect(menu).toBeVisible();

        await menu.click();
        await page.getByRole("menuitem", { name: "Log out" }).click();
        await page.waitForURL(/\/auth\/login/);
        const names = (await page.context().cookies()).map((val) => val.name);
        expect(names).not.toContain("access_token");
        expect(names).not.toContain("id_token");
    });

    test("rejects a forged callback", async ({ page }) => {
        await page.goto("/auth/api/callback?code=x&state=forged");
        await expect(page).toHaveURL(/\/auth\/error\?type=state/);
    });

    test("logs out only from the app's pages", async ({ page, request }) => {
        await login(page, "owner");
        const response = await request.post("/auth/api/logout", {
            headers: { Origin: "https://evil.example.org" },
            maxRedirects: 0,
        });
        expect(response.status()).toBe(303);
        expect(response.headers().location).toContain("type=logout-origin");
    });
});
