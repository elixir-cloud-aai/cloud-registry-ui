import { api, expect, login, registerService, test } from "./fixtures";

test.describe("services", () => {
    test("owners find, edit and delete their services", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Owned");
        await login(page, "owner");

        await page.goto("/dashboard/services");
        await page.getByLabel("Search services").fill(service.name);
        await page.getByText(service.name, { exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText(service.url);
        await page.keyboard.press("Escape");

        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("link", { name: "Edit" }).click();
        await page.waitForURL(/\/update\//);
        const renamed = `${service.name} renamed`;
        await page.locator("input[name=name]").fill(renamed);
        await page.getByRole("button", { name: "Submit" }).click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .body?.name,
            )
            .toBe(renamed);

        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(page.getByText(renamed, { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Delete" }).click();
        await expect
            .poll(
                async () =>
                    (await api(undefined, "GET", `/services/${service.id}`))
                        .status,
            )
            .toBe(404);
    });

    test("other users can't change a service", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "Not yours");
        await login(page, "other");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(
            page.getByText(service.name, { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
        for (const name of ["Delete", "Manage access", "Verify"])
            await expect(page.getByRole("button", { name })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    });

    test("admins verify services", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "To verify");
        await login(page, "admin");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("button", { name: "Verify", exact: true }).click();
        await expect(
            page.getByRole("button", { name: "Unverify" }),
        ).toBeVisible();
        expect(
            (
                await api(
                    undefined,
                    "GET",
                    `/services/${service.id}/verification`,
                )
            ).status,
        ).toBe(200);
    });

    test("guests see services without changing them", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Public");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await expect(
            page.getByText(service.name, { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(
            0,
        );
    });
});
