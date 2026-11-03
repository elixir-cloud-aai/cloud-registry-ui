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
