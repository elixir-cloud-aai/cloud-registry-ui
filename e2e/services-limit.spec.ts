import { expect, login, registry, test, uniqueId } from "./fixtures";

test.describe("services limit", () => {
    test("users at the limit are told so, with the limit", async ({
        page,
        problems,
    }) => {
        // a registry whose limit is reached: the registration fails with
        // the code, and the service info publishes the limit
        await page.route(`${registry}/services`, (route) =>
            route.request().method() === "POST"
                ? route.fulfill({
                      status: 409,
                      contentType: "application/problem+json",
                      body: JSON.stringify({
                          title: "Conflict",
                          detail: "You have registered as many services as allowed (3).",
                          code: "services-limit",
                      }),
                  })
                : route.fallback(),
        );
        await page.route(`${registry}/service-info`, async (route) => {
            const response = await route.fetch();
            const info = await response.json();
            await route.fulfill({
                response,
                json: {
                    ...info,
                    registration_rules: {
                        ...info.registration_rules,
                        max_services_per_user: 3,
                    },
                },
            });
        });

        await login(page, "owner");
        await page.goto("/dashboard/services/create");
        const id = uniqueId();
        const fields: [string, string][] = [
            ["Enter a descriptive name for your service", `Limited ${id}`],
            ["https://api.example.com/v1", `https://${id}.example.org/tes`],
            ["Enter your organization name", "E2E Org"],
            ["https://example.com", "https://example.org"],
            ["org.ga4gh", "org.ga4gh"],
            ["beacon, wes, trs, etc.", "tes"],
        ];
        for (const [name, value] of fields)
            await page.getByRole("textbox", { name }).fill(value);
        for (const field of await page
            .getByRole("textbox", { name: "1.0.0" })
            .all())
            await field.fill("1.1.0");
        await page.getByRole("button", { name: "Create Service" }).click();

        await expect(
            page.getByText(
                "You have registered as many services as this registry allows (3). Delete services you no longer need, or ask an admin.",
                // no hint at admin mode for users other than admins
                { exact: true },
            ),
        ).toBeVisible();
        // Chromium logs the 409 of the registration that the page shows,
        // Firefox doesn't; the fixture checks the list after the test
        expect(
            problems.filter(
                (val) =>
                    !(
                        val.includes("status of 409") &&
                        val.endsWith(`(${registry}/services)`)
                    ),
            ),
        ).toEqual([]);
        problems.length = 0;
    });
});
