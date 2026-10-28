import type { Page } from "@playwright/test";
import {
    api,
    expect,
    login,
    newService,
    registerService,
    registry,
    test,
    tokenOf,
    uniqueId,
    users,
} from "./fixtures";

/**
 * Drop the browser's message about the conflict (409) that a test causes on
 * purpose, so that only other problems fail it
 * @param problems Problems of the page
 * @param path Path of the request below the registry's base URL
 */
function dropConflict(problems: string[], path: string) {
    const others = problems.filter(
        (val) =>
            !(
                val.includes("status of 409") &&
                val.endsWith(`(${registry}${path})`)
            ),
    );
    problems.splice(0, problems.length, ...others);
}

/**
 * Submit changes in a service's edit form
 * @param page Page, logged in
 * @param id ID of the service
 * @param changes Values by the fields' names
 */
async function submitChanges(
    page: Page,
    id: string,
    changes: Record<string, string>,
) {
    await page.goto(`/dashboard/services/update/${id}`);
    await expect(page.locator("input[name=name]")).not.toHaveValue("");
    for (const [name, value] of Object.entries(changes))
        await page.locator(`input[name="${name}"]`).fill(value);
    await page.getByRole("button", { name: "Submit" }).click();
}

test.describe("conflicts", () => {
    test("changes to another service's URL and type show that service", async ({
        page,
        browser,
        problems,
    }) => {
        const registered = await registerService(browser, "owner", "First");
        const service = await registerService(browser, "owner", "Second");
        await login(page, "owner");
        await submitChanges(page, service.id, { url: registered.url });
        const toast = page
            .locator("[data-sonner-toast]")
            .filter({ hasText: registered.id });
        await expect(toast).toBeVisible();
        await expect(
            toast.getByRole("button", { name: "View service" }),
        ).toBeVisible();
        await expect(page.locator("input[name=url]")).toHaveAttribute(
            "aria-invalid",
            "true",
        );
        dropConflict(problems, `/services/${service.id}`);
    });

    test("owners of pending services see why they can't change them", async ({
        page,
        browser,
        problems,
    }) => {
        const owner = await tokenOf(browser, "owner");
        const type = {
            group: "org.example",
            artifact: `e2e-${uniqueId()}`,
            version: "1.0.0",
        };
        const created = await api(owner, "POST", "/services", {
            ...newService("Pending"),
            type,
        });
        expect(created.status).toBe(201);
        await login(page, "owner");
        const id = String(created.body);
        await submitChanges(page, id, {
            name: `Renamed ${uniqueId()}`,
        });
        await expect(
            page
                .locator("[data-sonner-toast]")
                .filter({ hasText: "pending until an admin approves it" }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "View service" }),
        ).toHaveCount(0);
        await expect(page.locator("input[name=url]")).not.toHaveAttribute(
            "aria-invalid",
            "true",
        );
        dropConflict(problems, `/services/${id}`);
    });

    test("the last owner stays", async ({ page, browser, problems }) => {
        const service = await registerService(browser, "owner", "Owned");
        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("button", { name: "Manage access" }).click();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: `Remove ${users.owner.sub}` })
            .click();
        await expect(
            page.getByText("Add another owner first, or delete the service."),
        ).toBeVisible();
        dropConflict(
            problems,
            `/services/${service.id}/permissions/${encodeURIComponent(users.owner.sub)}`,
        );
    });

    test("admins verify services only as they saw them", async ({
        page,
        browser,
        problems,
    }) => {
        const service = await registerService(browser, "owner", "Changing");
        await login(page, "admin", { adminMode: true });
        await page.goto(`/dashboard/services/view/${service.id}`);
        const verify = page.getByRole("button", {
            name: "Verify",
            exact: true,
        });
        await expect(verify).toBeVisible();
        const { id, ...data } = service;
        const changed = await api(
            await tokenOf(browser, "owner"),
            "PUT",
            `/services/${id}`,
            { ...data, url: `https://${uniqueId()}.tes.example.org` },
        );
        expect(changed.status).toBe(200);
        await verify.click();
        await expect(
            page.getByText(
                "The service changed after it was checked. Please check it again.",
            ),
        ).toBeVisible();
        dropConflict(problems, `/services/${id}/verification`);
    });
});
