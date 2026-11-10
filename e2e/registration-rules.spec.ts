import type { Page } from "@playwright/test";
import {
    api,
    expect,
    isRead,
    login,
    registerService,
    registry,
    test,
    waitForReads,
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
                registrationRules: { ...info.registrationRules, ...rules },
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
        // the form reads the service again, with the service info through
        // the test's route, whose fetch would fail on the closed page
        await waitForReads(
            page,
            () => page.getByRole("button", { name: "Submit" }).click(),
            [isRead(`/services/${service.id}`)],
        );
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .body?.url,
            )
            .toBe(url);
    });

    test("the edit form takes any environment and checks schemes", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Any env");
        await publishRules(page, { environments: [], urlSchemes: ["https"] });
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

    test("the edit form shows the registry's reason at the field", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "Reasons");
        // any environment, so that the registry checks it
        await publishRules(page, { environments: [] });
        await login(page, "owner");

        await page.goto(`/dashboard/services/update/${service.id}`);
        await page
            .getByRole("textbox", { name: "Environment" })
            .fill("production");
        await page.getByRole("button", { name: "Submit" }).click();

        // the field with its message (`errors` of cloud-registry 1.0.0rc2, in
        // the words of the registry that the stack pins)
        // the innermost group with the field (the form is one, too)
        const field = page
            .getByRole("group")
            .filter({
                has: page.getByRole("textbox", { name: "Environment" }),
            })
            .last();
        await expect(field.getByRole("alert")).toHaveText(
            /^Must be one of: 'prod'/,
        );
        // and the toast with the field's label, not its JSON Pointer
        const toast = page
            .locator("[data-sonner-toast]")
            .filter({ hasText: "'Environment': Must be one of" });
        await expect(toast).toBeVisible();
        await expect(toast).not.toContainText("#/");
        expect(
            (await api(undefined, "GET", `/services/${service.id}`)).body
                ?.environment,
        ).toBe(service.environment);

        await page.unrouteAll({ behavior: "ignoreErrors" });
        // the registry's refusal, which the browser logs
        expect(
            problems.filter((val) => !val.includes("status of 400")),
        ).toEqual([]);
        problems.length = 0;
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
        // the form reads the service again, with the service info and the
        // pending entries, whose failures would come after the check
        await waitForReads(
            page,
            () => page.getByRole("button", { name: "Submit" }).click(),
            [isRead(`/services/${service.id}`)],
        );
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .body?.url,
            )
            .toBe(url);
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
