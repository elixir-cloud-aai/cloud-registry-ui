import { expect, test } from "./fixtures";

// the check of every test for problems in the browser must catch them
test.describe("problem check", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/auth/login");
    });

    test.afterEach(({ problems }) => {
        // caused on purpose
        problems.length = 0;
    });

    test("catches CSP violations", async ({ page, problems }) => {
        await page.evaluate(() => {
            const image = document.createElement("img");
            // `img-src` allows https only
            image.src = "http://example.com/blocked.png";
            document.body.append(image);
        });
        await expect
            .poll(() => problems)
            .toContainEqual(expect.stringMatching(/^CSP: /));
    });

    test("catches page errors", async ({ page, problems }) => {
        await page.evaluate(() => {
            setTimeout(() => {
                throw new Error("boom");
            });
        });
        await expect.poll(() => problems).toContain("page error: boom");
    });

    test("catches logged errors", async ({ page, problems }) => {
        await page.evaluate(() => console.error("boom"));
        await expect
            .poll(() => problems)
            .toContainEqual(expect.stringMatching(/^console error: boom /));
    });

    test("catches server errors", async ({ page, problems }) => {
        await page.route("**/boom", (route) =>
            route.fulfill({ status: 500, body: "boom" }),
        );
        await page.evaluate(() => fetch("/boom"));
        await expect
            .poll(() => problems)
            .toContainEqual(expect.stringMatching(/^server error: 500 /));
    });

    test("catches failed requests", async ({ page, problems }) => {
        await page.route("**/boom", (route) => route.abort("failed"));
        await page.evaluate(() => fetch("/boom").catch(() => undefined));
        await expect
            .poll(() => problems)
            .toContainEqual(expect.stringMatching(/^failed request: /));
    });
});
