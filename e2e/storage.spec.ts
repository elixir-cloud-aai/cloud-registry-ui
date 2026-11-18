import { expect, isRead, openPage, test } from "./fixtures";

// see "Cookies and storage" in `docs/operator-guide/legal.md`: the app
// needs no consent banner as long as guests get nothing stored
test.describe("storage", () => {
    test("a guest's visit stores nothing", async ({ page }) => {
        await openPage(page, "/dashboard/services", [isRead("/services")]);
        // shadcn's sidebar keeps its state in a cookie upstream, not here
        const toggle = page.getByRole("button", { name: "Toggle Sidebar" });
        await toggle.first().click();
        await toggle.first().click();
        await page.goto("/invitations");
        await expect(page.getByText("No Invitation to Accept")).toBeVisible();
        await page.goto("/auth/login");
        expect(await page.context().cookies()).toEqual([]);
        const storage = await page.evaluate(() => ({
            local: Object.keys(localStorage),
            session: Object.keys(sessionStorage),
        }));
        expect(storage).toEqual({ local: [], session: [] });
    });
});
