import { createHash } from "node:crypto";
import { expect, test } from "./fixtures";

// SHA-256 of the ELIXIR On-Cloud mark, day version, as the maintainer
// provides it (logo_elixir_on_cloud_mark.png); not taken from the app, so
// that another icon in `src/app/icon.png` fails the test
const markDigest =
    "0d69b6f5818314702278aef56ad212855c61da57061cc59b04c5d61d2571abaa";

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
        const digest = createHash("sha256")
            .update(await response.body())
            .digest("hex");
        expect(digest).toBe(markDigest);
        // the old logo is gone
        const old = await page.request.get("/favicon.ico");
        expect(old.status()).toBe(404);
    });
});
