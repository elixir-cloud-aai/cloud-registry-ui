import { api, expect, login, newService, test, tokenOf } from "./fixtures";

test.describe("service types", () => {
    test("new types of users are pending until an admin approves them", async ({
        page,
        browser,
    }) => {
        const owner = await tokenOf(browser, "owner");
        const type = {
            group: "org.example",
            artifact: `e2e-${Date.now()}`,
            version: "1.0.0",
        };
        const service = { ...newService("Pending"), type };
        expect((await api(owner, "POST", "/services/types", type)).status).toBe(
            201,
        );
        const created = await api(owner, "POST", "/services", service);
        expect(created.status).toBe(201);
        // hidden from the public reads while pending
        expect(
            (await api(undefined, "GET", `/services/${created.body}`)).status,
        ).toBe(404);

        await login(page, "admin");
        await page.goto(`/dashboard/services/view/${created.body}`);
        await expect(page.getByText("Pending").first()).toBeVisible();
        await page.getByRole("button", { name: "Approve" }).click();
        await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Approve" })
            .click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${created.body}`))
                        .status,
            )
            .toBe(200);
    });
});
