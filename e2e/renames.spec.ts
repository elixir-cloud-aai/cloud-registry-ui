import type { Page } from "@playwright/test";
import {
    api,
    expect,
    login,
    registerService,
    registry,
    test,
    tokenOf,
    uniqueId,
    users,
} from "./fixtures";

/**
 * Open a service's edit form, once it shows the service
 * @param page Page, logged in
 * @param id ID of the service
 */
async function openForm(page: Page, id: string) {
    await page.goto(`/dashboard/services/update/${encodeURIComponent(id)}`);
    await expect(page.locator("input[name=name]")).not.toHaveValue("");
}

const takenMessage =
    "A service with this ID is already registered. Please choose another ID.";

/**
 * Submit the edit form and confirm the new ID
 * @param page Page, with the form
 */
async function submitRename(page: Page) {
    await page.getByRole("button", { name: "Submit" }).click();
    await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Change ID" })
        .click();
}

/**
 * Find a toast by its text
 * @param page Page
 * @param text Text of the toast
 */
function toast(page: Page, text: string) {
    return page.locator("[data-sonner-toast]").filter({ hasText: text });
}

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

test.describe("renames", () => {
    test("admins change a service's ID, with its other fields", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Renamed");
        const admin = await tokenOf(browser, "admin");
        const verified = await api(
            admin,
            "PUT",
            `/services/${service.id}/verification`,
            { url: service.url, type: service.type },
        );
        expect(verified.status).toBeLessThan(300);
        await login(page, "admin");
        await openForm(page, service.id);

        // with a space and a literal %25, which must stay as they are in
        // the URL's round trip
        const newId = `renamed %25 ${uniqueId()}`;
        const path = encodeURIComponent(newId);
        const name = `Renamed ${uniqueId()}`;
        await page.locator("input[name=id]").fill(newId);
        await page.locator("input[name=name]").fill(name);
        await page.getByRole("button", { name: "Submit" }).click();
        const dialog = page.getByRole("alertdialog");
        await expect(dialog).toContainText(service.id);
        await expect(dialog).toContainText(newId);
        await dialog.getByRole("button", { name: "Change ID" }).click();

        await expect(page).toHaveURL(`/dashboard/services/update/${path}`);
        await expect(page.locator("input[name=id]")).toHaveValue(newId);
        await expect(page.locator("input[name=name]")).toHaveValue(name);
        expect(
            (await api(admin, "GET", `/services/${service.id}`)).status,
        ).toBe(404);
        // the roles and the verification moved with it
        const permissions = await api(
            admin,
            "GET",
            `/services/${path}/permissions`,
        );
        expect(JSON.stringify(permissions.body)).toContain(users.owner.sub);
        expect(
            (await api(undefined, "GET", `/services/${path}/verification`))
                .status,
        ).toBe(200);
    });

    test("admins can cancel a change of the ID", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "Kept");
        await login(page, "admin");
        await openForm(page, service.id);
        await page.locator("input[name=id]").fill(`kept-${uniqueId()}`);
        await page.getByRole("button", { name: "Submit" }).click();
        await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Cancel" })
            .click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(page).toHaveURL(
            `/dashboard/services/update/${service.id}`,
        );
        const admin = await tokenOf(browser, "admin");
        expect(
            (await api(admin, "GET", `/services/${service.id}`)).status,
        ).toBe(200);
    });

    test("IDs that are taken or invalid stay in the form", async ({
        page,
        browser,
        problems,
    }) => {
        const taken = await registerService(browser, "owner", "Taken");
        const service = await registerService(browser, "owner", "Renaming");
        await login(page, "admin");
        await openForm(page, service.id);
        const idField = page.locator("input[name=id]");

        // checked before the request, as the registry checks them
        await idField.fill("a/b");
        await idField.blur();
        await expect(
            page.getByText("Service ID must not contain slashes."),
        ).toBeVisible();

        await idField.fill(taken.id);
        await submitRename(page);
        await expect(toast(page, takenMessage)).toBeVisible();
        await expect(idField).toHaveAttribute("aria-invalid", "true");
        await expect(idField).toHaveValue(taken.id);
        await expect(page).toHaveURL(
            `/dashboard/services/update/${service.id}`,
        );
        dropConflict(problems, `/services/${service.id}/rename`);

        // and can be changed and sent again
        const newId = `renamed-${uniqueId()}`;
        await idField.fill(newId);
        await submitRename(page);
        await expect(page).toHaveURL(`/dashboard/services/update/${newId}`);
        await expect(idField).toHaveValue(newId);
    });

    test("other changes are saved before the rename", async ({
        page,
        browser,
        problems,
    }) => {
        const taken = await registerService(browser, "owner", "Taken");
        const service = await registerService(browser, "owner", "Renaming");
        await login(page, "admin");
        await openForm(page, service.id);

        const name = `Saved ${uniqueId()}`;
        await page.locator("input[name=name]").fill(name);
        await page.locator("input[name=id]").fill(taken.id);
        await submitRename(page);
        await expect(
            toast(
                page,
                `Saved the other changes, but cannot change the ID: ${takenMessage}`,
            ),
        ).toBeVisible();
        // the form shows the saved service
        await expect(page.locator("input[name=id]")).toHaveValue(service.id);
        await expect(page.locator("input[name=name]")).toHaveValue(name);
        const admin = await tokenOf(browser, "admin");
        const saved = await api(admin, "GET", `/services/${service.id}`);
        expect(saved.body.name).toBe(name);
        dropConflict(problems, `/services/${service.id}/rename`);
    });

    test("failed updates change no ID", async ({ page, browser, problems }) => {
        const registered = await registerService(browser, "owner", "First");
        const service = await registerService(browser, "owner", "Second");
        await login(page, "admin");
        await openForm(page, service.id);

        const newId = `renamed-${uniqueId()}`;
        await page.locator("input[name=url]").fill(registered.url);
        await page.locator("input[name=id]").fill(newId);
        await submitRename(page);
        await expect(page.locator("input[name=url]")).toHaveAttribute(
            "aria-invalid",
            "true",
        );
        const admin = await tokenOf(browser, "admin");
        expect(
            (await api(admin, "GET", `/services/${service.id}`)).status,
        ).toBe(200);
        expect((await api(admin, "GET", `/services/${newId}`)).status).toBe(
            404,
        );
        dropConflict(problems, `/services/${service.id}`);
    });

    test("other users can't change IDs", async ({ page, browser }) => {
        const service = await registerService(browser, "owner", "Fixed");
        await login(page, "owner");
        await openForm(page, service.id);
        await expect(page.locator("input[name=id]")).toHaveCount(0);
        await expect(page.locator("#serviceId")).toHaveValue(service.id);
        await expect(page.locator("#serviceId")).toHaveAttribute(
            "readonly",
            "",
        );
        await expect(
            page.getByText("Only admins can change the ID."),
        ).toBeVisible();
    });
});
