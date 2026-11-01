import type { Page } from "@playwright/test";
import {
    api,
    expect,
    login,
    registerService,
    registry,
    test,
} from "./fixtures";

/**
 * Let the page see other registration rules than the registry's own
 * @param page Page
 * @param rules Rules that replace the published ones
 */
async function publishRules(page: Page, rules: object) {
    await page.route(`${registry}/service-info`, async (route) => {
        const response = await route.fetch();
        const info = await response.json();
        await route.fulfill({
            response,
            json: {
                ...info,
                registration_rules: { ...info.registration_rules, ...rules },
            },
        });
    });
}

test.describe("registration rules", () => {
    test("the edit form follows the registry's rules", async ({
        page,
        browser,
    }) => {
        // the stack allows http, which the app's defaults don't
        const service = await registerService(browser, "owner", "Rules");
        await publishRules(page, { environments: ["test", "prod"] });
        await login(page, "owner");

        await page.goto(`/dashboard/services/update/${service.id}`);
        await page.getByRole("combobox", { name: "Environment" }).click();
        await expect(page.getByRole("option")).toHaveText([
            "Not set",
            "test",
            "prod",
        ]);
        await page.keyboard.press("Escape");

        const url = service.url.replace("https:", "http:");
        await page.locator("input[name=url]").fill(url);
        await page.getByRole("button", { name: "Submit" }).click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .body?.url,
            )
            .toBe(url);
        await page.waitForLoadState("networkidle");
    });

    test("the edit form takes any environment and checks schemes", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Any env");
        await publishRules(page, { environments: [], url_schemes: ["https"] });
        await login(page, "owner");

        await page.goto(`/dashboard/services/update/${service.id}`);
        await expect(
            page.getByRole("textbox", { name: "Environment" }),
        ).toHaveValue("test");
        await page
            .locator("input[name=url]")
            .fill(service.url.replace("https:", "http:"));
        await expect(
            page.getByText(
                "Service URL must be an https URL, e.g. https://example.org/.",
            ),
        ).toBeVisible();
    });

    test("without the rules, the edit form says so and leaves the checks to the registry", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "No rules");
        await page.route(`${registry}/service-info`, (route) =>
            route.fulfill({ status: 503, body: "" }),
        );
        await login(page, "owner");

        await page.goto(`/dashboard/services/update/${service.id}`);
        await expect(
            page.getByText(
                "The registry's rules for registrations are unknown",
                { exact: false },
            ),
        ).toBeVisible();
        await expect(
            page.getByRole("textbox", { name: "Environment" }),
        ).toHaveValue("test");
        // the registry of the stack allows http
        const url = service.url.replace("https:", "http:");
        await page.locator("input[name=url]").fill(url);
        await page.getByRole("button", { name: "Submit" }).click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .body?.url,
            )
            .toBe(url);
        await page.waitForLoadState("networkidle");
        // the failed reads of the service info, which the page reports
        expect(
            problems.filter(
                (val) =>
                    !val.includes(`${registry}/service-info`) &&
                    !val.includes("Failed to load the registration rules"),
            ),
        ).toEqual([]);
        problems.length = 0;
    });
});
