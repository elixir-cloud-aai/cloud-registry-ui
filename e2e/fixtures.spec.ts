import { test } from "./fixtures";

// the check of every test for problems in the browser must catch them:
// these tests pass only because they fail
test.describe("problem check", () => {
    test("fails a test on a CSP violation", async ({ page }) => {
        test.fail();
        await page.goto("/auth/login");
        await page.evaluate(() => {
            const image = document.createElement("img");
            // `img-src` allows https only
            image.src = "http://example.com/blocked.png";
            document.body.append(image);
        });
        await page.waitForTimeout(500);
    });

    test("fails a test on a page error", async ({ page }) => {
        test.fail();
        await page.goto("/auth/login");
        await page.evaluate(() => {
            setTimeout(() => {
                throw new Error("boom");
            });
        });
        await page.waitForTimeout(500);
    });

    test("fails a test on a logged error", async ({ page }) => {
        test.fail();
        await page.goto("/auth/login");
        await page.evaluate(() => console.error("boom"));
        await page.waitForTimeout(500);
    });

    test("fails a test on a server error", async ({ page }) => {
        test.fail();
        await page.route("**/auth/login", (route) =>
            route.fulfill({ status: 500, body: "boom" }),
        );
        await page.goto("/auth/login");
    });
});
