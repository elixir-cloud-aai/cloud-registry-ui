import {
    addTesType,
    expect,
    failWithConflict,
    login,
    publishRules,
    registry,
    test,
} from "./fixtures";

/**
 * Drop the console messages of the conflicts that a test causes on purpose
 * (Chromium logs them, Firefox doesn't); the fixture checks the rest after
 * the test
 * @param problems The page's problems
 */
function dropConflicts(problems: string[]) {
    const rest = problems.filter(
        (val) =>
            !(
                val.includes("status of 409") &&
                val.includes(`(${registry}/services/types`)
            ),
    );
    expect(rest).toEqual([]);
    problems.length = 0;
}

test.describe("service type limits", () => {
    test("users who may have no unused types aren't offered adding types", async ({
        page,
    }) => {
        await publishRules(page, { maxUnusedServiceTypes: 0 });
        await login(page, "other");
        await page.goto("/dashboard/service-types");

        await expect(
            page.getByText(
                "Only admins can add service types in this registry. Please ask an admin to add the type you need.",
            ),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Add Service Type" }),
        ).toHaveCount(0);
        await expect(
            page.getByText("New service types are pending"),
        ).toHaveCount(0);
    });

    test("admins in admin mode add types also without unused types", async ({
        page,
    }) => {
        await publishRules(page, { maxUnusedServiceTypes: 0 });
        await login(page, "admin", { adminMode: true });
        await page.goto("/dashboard/service-types");

        await page.getByRole("button", { name: "Add Service Type" }).click();
        await expect(
            page.getByRole("heading", {
                name: "Add Service Type",
                exact: true,
            }),
        ).toBeVisible();
        // no limit for admins
        await expect(
            page
                .getByRole("dialog")
                .getByText("Services can then be registered with this type.", {
                    exact: true,
                }),
        ).toBeVisible();
        await expect(
            page.getByText("Only admins can add service types"),
        ).toHaveCount(0);
    });

    test("the dialog names the limit of unused types", async ({ page }) => {
        await publishRules(page, { maxUnusedServiceTypes: 3 });
        await login(page, "owner");
        await page.goto("/dashboard/service-types");

        await page.getByRole("button", { name: "Add Service Type" }).click();
        await expect(page.getByRole("dialog")).toContainText(
            "You may have added up to 3 service types that no service has",
        );
    });

    test("adding a registered type says so", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        await login(page, "owner");
        await page.goto("/dashboard/service-types");

        await page.getByRole("button", { name: "Add Service Type" }).click();
        const dialog = page.getByRole("dialog");
        await dialog
            .getByRole("textbox", { name: "Type Artifact" })
            .fill("tes");
        await dialog
            .getByRole("textbox", { name: "Type Version" })
            .fill("1.1.0");
        await dialog.getByRole("button", { name: "Add" }).click();

        await expect(
            page.getByText(
                "This service type is already registered. If you can't find it, it may be pending until an admin approves it.",
            ),
        ).toBeVisible();
        dropConflicts(problems);
    });

    test("adding a type over the limit says what to do", async ({
        page,
        problems,
    }) => {
        await failWithConflict(
            page,
            "/services/types",
            "POST",
            "unused-types-limit",
        );
        await login(page, "owner");
        await page.goto("/dashboard/service-types");

        await page.getByRole("button", { name: "Add Service Type" }).click();
        const dialog = page.getByRole("dialog");
        await dialog
            .getByRole("textbox", { name: "Type Artifact" })
            .fill("over-limit");
        await dialog
            .getByRole("textbox", { name: "Type Version" })
            .fill("1.0.0");
        await dialog.getByRole("button", { name: "Add" }).click();

        await expect(
            page.getByText(
                "You have added as many service types that no service has as this registry allows.",
                { exact: false },
            ),
        ).toBeVisible();
        await expect(page.getByText("The registry's own detail.")).toHaveCount(
            0,
        );
        dropConflicts(problems);
    });

    test("removing a type in use says what to do", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        await failWithConflict(
            page,
            "/services/types",
            "DELETE",
            "service-type-in-use",
        );
        await login(page, "admin", { adminMode: true });
        await page.goto("/dashboard/service-types");

        await page
            .getByRole("button", { name: /^Remove / })
            .first()
            .click();
        await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Remove" })
            .click();

        await expect(
            page.getByText(
                "Services have this service type, so it can't be removed. Change the type of these services, or delete them, first.",
            ),
        ).toBeVisible();
        dropConflicts(problems);
    });
});
