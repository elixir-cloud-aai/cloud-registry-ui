import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

test.describe("branding", () => {
    test("the sidebar title is at most 22 px", async ({ page }) => {
        await page.goto("/dashboard/services");
        const title = page
            .getByRole("link", { name: "Cloud Registry" })
            .first();
        await expect(title).toBeVisible();
        const size = await title
            .getByText("Cloud Registry", { exact: true })
            .evaluate((val) =>
                Number.parseFloat(getComputedStyle(val).fontSize),
            );
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(22);
    });

    test("the favicon is the ELIXIR On-Cloud mark", async ({ page }) => {
        await page.goto("/dashboard/services");
        const href = await page
            .locator('link[rel="icon"]')
            .first()
            .getAttribute("href");
        expect(href).toMatch(/^\/icon\.png/);
        const response = await page.request.get(href as string);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toBe("image/png");
        expect(
            Buffer.compare(
                await response.body(),
                readFileSync("src/app/icon.png"),
            ),
        ).toBe(0);
        // the old logo is gone
        const old = await page.request.get("/favicon.ico");
        expect(old.status()).toBe(404);
    });
});
