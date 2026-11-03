import type { Page } from "@playwright/test";
import { expect, publishRules, registry, test } from "./fixtures";

test.describe("service info", () => {
    test("shows the registry's rules for registrations", async ({ page }) => {
        await page.goto("/dashboard/service-info");

        const rules = page.getByRole("region", { name: "Registration Rules" });
        // the rules of the stack (`e2e/stack/registry.yaml`)
        await expect(rules.getByRole("term")).toHaveText([
            "Environments",
            "URL schemes",
            "Who may add service types",
            "Unused service types per user",
            "Services per user",
        ]);
        await expect(rules.getByRole("definition")).toHaveText([
            "prod, test, dev, staging",
            "http, https",
            "Logged-in users; types of users other than admins are pending until an admin approves them",
            "10",
            "No limit",
        ]);
    });

    test("explains limits of 0", async ({ page }) => {
        await publishRules(page, {
            environments: [],
            max_unused_service_types: 0,
            max_services_per_user: 0,
        });
        await page.goto("/dashboard/service-info");

        const rules = page.getByRole("region", { name: "Registration Rules" });
        await expect(rules.getByRole("definition")).toHaveText([
            "Any",
            "http, https",
            "Admins only",
            "None: only admins add service types",
            "None: only admins register services",
        ]);
    });

    test("leaves out the rules of registries that publish none", async ({
        page,
    }) => {
        await page.route(`${registry}/service-info`, async (route) => {
            const response = await route.fetch();
            const { registration_rules: _, ...info } = await response.json();
            await route.fulfill({ response, json: info });
        });
        await page.goto("/dashboard/service-info");

        await expect(page.getByText("Registry Version")).toBeVisible();
        await expect(
            page.getByRole("region", { name: "Registration Rules" }),
        ).toHaveCount(0);
    });

    test("shows the environment as the registry reports it", async ({
        page,
    }) => {
        await page.route(`${registry}/service-info`, async (route) => {
            const response = await route.fetch();
            await route.fulfill({
                response,
                json: { ...(await response.json()), environment: "prod" },
            });
        });
        await page.goto("/dashboard/service-info");

        // the rendered text, as `text-transform` doesn't change `textContent`
        await expect(page.locator('[data-slot="badge"]')).toHaveText("prod", {
            useInnerText: true,
        });
        await expect(
            page.getByText("Environment:").locator("xpath=.."),
        ).toHaveText("Environment: prod", { useInnerText: true });
    });

    /**
     * Serve the app's pages with another registry setting, as the server
     * refuses to start with a missing or relative one
     * @param page Page
     * @param setting The setting
     */
    async function withSetting(page: Page, setting: string) {
        await page.route("**/dashboard/service-info", async (route) => {
            const response = await route.fetch();
            const html = await response.text();
            // the test means nothing if the page has the setting in another form
            expect(html).toContain(registry);
            await route.fulfill({
                response,
                body: html.replaceAll(registry, setting),
            });
        });
        // the app's own site passes the calls on to the registry
        await page.route(`**${setting}/service-info`, async (route) => {
            // with an empty setting, the pattern also matches the page
            if (route.request().resourceType() === "document")
                return route.fallback();
            const response = await route.fetch({
                url: `${registry}/service-info`,
            });
            await route.fulfill({ response });
        });
    }

    test("shows the API that the app is configured with", async ({ page }) => {
        await page.goto("/dashboard/service-info");

        await expect(
            page
                .getByRole("region", { name: "API Address" })
                .getByRole("code"),
        ).toHaveText(registry);
    });

    test("copies the API address", async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "clipboard", {
                value: {
                    writeText: async (text: string) => {
                        Object.assign(window, { copied: text });
                    },
                },
            });
        });
        await page.goto("/dashboard/service-info");

        await page.getByRole("button", { name: "Copy API address" }).click();

        await expect(page.getByText("Copied the API address.")).toBeVisible();
        expect(await page.evaluate(() => Reflect.get(window, "copied"))).toBe(
            registry,
        );
    });

    test("says so if it can't copy the API address", async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "clipboard", {
                value: undefined,
            });
        });
        await page.goto("/dashboard/service-info");

        await page.getByRole("button", { name: "Copy API address" }).click();

        await expect(
            page.getByText("Cannot copy the API address."),
        ).toBeVisible();
    });

    test("shows a relative API address as the browser resolves it", async ({
        page,
        baseURL,
    }) => {
        await withSetting(page, "/ga4gh/registry/v1");
        await page.goto("/dashboard/service-info");

        await expect(
            page
                .getByRole("region", { name: "API Address" })
                .getByRole("code"),
        ).toHaveText(`${baseURL}/ga4gh/registry/v1`);
    });

    test("leaves out the API address without the setting", async ({ page }) => {
        await withSetting(page, "");
        await page.goto("/dashboard/service-info");

        await expect(page.getByText("Registry Version")).toBeVisible();
        await expect(
            page.getByRole("region", { name: "API Address" }),
        ).toHaveCount(0);
    });

    test("labels the registry type and the links", async ({ page }) => {
        await page.route(`${registry}/service-info`, async (route) => {
            const response = await route.fetch();
            await route.fulfill({
                response,
                json: {
                    ...(await response.json()),
                    documentationUrl: "https://docs.example.org/",
                },
            });
        });
        await page.goto("/dashboard/service-info");

        // the order of the service type tiles, with a space after each colon
        await expect(
            page
                .getByRole("list")
                .filter({ hasText: "Spec Version:" })
                .getByRole("listitem"),
        ).toHaveText([/^Group: \S/, /^Artifact: \S/, /^Spec Version: \S/]);
        const docs = page.getByRole("link", { name: "Documentation URL" });
        await expect(docs).toHaveAttribute("href", "https://docs.example.org/");
        await docs.hover();
        await expect(page.getByRole("tooltip")).toHaveText("Documentation URL");
    });
});
