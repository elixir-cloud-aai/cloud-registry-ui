import {
    addTesType,
    api,
    expect,
    fillCreateForm,
    login,
    newService,
    registry,
    test,
    uniqueId,
} from "./fixtures";

const pendingNote =
    "New service types are pending until an admin approves them, and so are the services that have them.";

test.describe("registering services", () => {
    test("users choose a registered type and an allowed environment", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        // a registry that allows two environments, one without a label
        await page.route(`${registry}/service-info`, async (route) => {
            const response = await route.fetch();
            const info = await response.json();
            await route.fulfill({
                response,
                json: {
                    ...info,
                    registration_rules: {
                        ...info.registration_rules,
                        environments: ["test", "qa"],
                    },
                },
            });
        });
        const token = await login(page, "owner");
        await page.goto("/dashboard/services/create");

        // new types of users are pending in the registry of the tests
        await expect(page.getByText(pendingNote)).toBeVisible();
        // only admins choose IDs and dates
        await expect(page.getByText("Advanced Configuration")).toHaveCount(0);

        const service = newService("Registered");
        await fillCreateForm(page, service);
        await page.getByRole("button", { name: "Select environment" }).click();
        await expect(page.getByRole("option", { name: "qa" })).toBeVisible();
        await expect(
            page.getByRole("option", { name: "Production" }),
        ).toHaveCount(0);
        await page.getByRole("option", { name: "Test" }).click();
        await page.getByRole("button", { name: "Create Service" }).click();

        await expect(
            page.getByText(`Registered ${service.name}`),
        ).toBeVisible();
        await page.waitForURL(/\/dashboard\/services$/);
        const mine = await api(token, "GET", "/me");
        const ids: string[] = mine.body.services.map(
            (val: { service_id: string }) => val.service_id,
        );
        const created = await Promise.all(
            ids.map(
                async (id) => (await api(token, "GET", `/services/${id}`)).body,
            ),
        );
        expect(created.find((val) => val?.name === service.name)).toMatchObject(
            { type: service.type, environment: "test" },
        );
    });

    test("users who may add types can add a new one", async ({ page }) => {
        await login(page, "owner");
        await page.goto("/dashboard/services/create");
        await page
            .getByRole("button", { name: "Select a service type" })
            .click();
        await page
            .getByRole("option", { name: "Add new service type" })
            .click();
        await expect(
            page.getByRole("textbox", { name: "beacon, wes, trs, etc." }),
        ).toBeVisible();
    });

    test("users who may not add types choose a registered one", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        await page.route(`${registry}/me`, async (route) => {
            const response = await route.fetch();
            const me = await response.json();
            await route.fulfill({
                response,
                json: { ...me, may_add_service_types: false },
            });
        });
        await login(page, "owner");
        // the form follows the user once it is loaded
        const me = page.waitForResponse(`${registry}/me`);
        await page.goto("/dashboard/services/create");
        await me;
        await page
            .getByRole("button", { name: "Select a service type" })
            .click();
        await expect(
            page.getByRole("option", { name: "org.ga4gh · tes · 1.1.0" }),
        ).toBeVisible();
        await expect(
            page.getByRole("option", { name: "Add new service type" }),
        ).toHaveCount(0);
        await expect(page.getByText(pendingNote)).toHaveCount(0);
    });

    test("admins in admin mode choose the ID", async ({ page, browser }) => {
        await addTesType(browser);
        await login(page, "admin");
        await page.goto("/dashboard/services/create");
        const userMode = page.getByRole("button", { name: "User mode" });
        await expect(userMode).toBeVisible();
        // in user mode, admins register services like other users
        await expect(page.getByText("Advanced Configuration")).toHaveCount(0);

        await userMode.click();
        await expect(
            page.getByRole("button", { name: "Admin mode" }),
        ).toBeVisible();
        const service = newService("Chosen ID");
        const id = `e2e-${uniqueId()}`;
        await fillCreateForm(page, service);
        await page.getByText("Advanced Configuration").click();
        await page
            .getByRole("textbox", { name: "org.example.my-service (optional)" })
            .fill(id);
        await page.getByRole("button", { name: "Create Service" }).click();

        await expect(
            page.getByText(`Registered ${service.name} with ID - ${id}`),
        ).toBeVisible();
        expect(
            (await api(undefined, "GET", `/services/${id}`)).body,
        ).toMatchObject({ name: service.name });
    });

    test("duplicates link to the registered service", async ({
        page,
        browser,
        problems,
    }) => {
        await addTesType(browser);
        const token = await login(page, "owner");
        const service = newService("Duplicate");
        const created = await api(token, "POST", "/services", service);
        expect(created.status).toBe(201);

        await page.goto("/dashboard/services/create");
        await fillCreateForm(page, {
            ...service,
            name: `${service.name} again`,
        });
        await page.getByRole("button", { name: "Create Service" }).click();

        // the registry's detail, with what to do
        await expect(
            page.getByText("Please contact its owner or an admin."),
        ).toBeVisible();
        const popup = page.waitForEvent("popup");
        await page.getByRole("button", { name: "View service" }).click();
        await (await popup).waitForURL(
            new RegExp(`/dashboard/services/view/${created.body}$`),
        );
        // Chromium logs the 409 of the registration that the page shows
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

    test("unsaved input asks before the page is left", async ({ page }) => {
        await login(page, "owner");
        await page.goto("/dashboard/services/create");
        const name = page.getByRole("textbox", {
            name: "Enter a descriptive name for your service",
        });

        // what users answer when the page asks before it's left
        let asked = 0;
        page.on("dialog", (dialog) => {
            asked++;
            return dialog.dismiss();
        });
        // the form has loaded the user and the types
        await expect(page.getByText(pendingNote)).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Select a service type" }),
        ).toBeVisible();
        await name.fill("Not saved");
        await page.getByRole("link", { name: "Services", exact: true }).click();
        await expect(
            page.getByRole("heading", { name: "Unsaved changes" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Stay" }).click();
        await expect(name).toHaveValue("Not saved");

        // nothing to ask after Reset
        await page.getByRole("button", { name: "Reset" }).click();
        await expect(name).toHaveValue("");
        await page.getByRole("link", { name: "Services", exact: true }).click();
        await page.waitForURL(/\/dashboard\/services$/);
        expect(asked).toBe(0);
    });
});
