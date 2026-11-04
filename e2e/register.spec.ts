import type { Page } from "@playwright/test";
import {
    addTesType,
    api,
    expect,
    fillCreateForm,
    login,
    newService,
    openCreateForm,
    publishRules,
    registry,
    test,
    uniqueId,
} from "./fixtures";

const pendingNote =
    "New service types are pending until an admin approves them, and so are the services that have them.";

/**
 * Check that the form offers no admin-only fields: neither the section
 * nor the custom ID and the dates
 * @param page Page with the form
 */
async function expectNoAdminFields(page: Page) {
    await expect(page.getByText("Advanced Configuration")).toHaveCount(0);
    await expect(
        page.getByRole("textbox", {
            name: "org.example.my-service (optional)",
        }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("textbox", { name: "2019-06-04T12:58:19Z (optional)" }),
    ).toHaveCount(0);
}

test.describe("registering services", () => {
    // remove the routes of `publishRules()`, which the page may still use
    // when a test ends
    test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    test("users choose a registered type and an allowed environment", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        // a registry that allows two environments, one without a label
        await publishRules(page, { environments: ["test", "qa"] });
        const token = await login(page, "owner");
        const form = await openCreateForm(page);

        // new types of users are pending in the registry of the tests
        await expect(page.getByText(pendingNote)).toBeVisible();
        // only admins choose IDs and dates
        await expectNoAdminFields(page);

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
        // the modal closes, and the list shows the new service
        await expect(form).toBeHidden();
        await page.getByLabel("Search services").fill(service.name);
        await expect(
            page.getByText(service.name, { exact: true }),
        ).toBeVisible();
        const mine = await api(token, "GET", "/me");
        const ids: string[] = mine.body.services.map(
            (val: { serviceId: string }) => val.serviceId,
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

    test("invalid entries are reported before sending", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        // a registry that allows https only (the stack allows http, too)
        await publishRules(page, { urlSchemes: ["https"] });
        let registrations = 0;
        page.on("request", (request) => {
            if (
                request.method() === "POST" &&
                request.url() === `${registry}/services`
            )
                registrations++;
        });
        await login(page, "owner");
        let rulesRead = 0;
        page.on("response", (response) => {
            if (response.url() === `${registry}/service-info`) rulesRead++;
        });
        await openCreateForm(page);
        // the modal and the form have read the rules
        await expect.poll(() => rulesRead).toBeGreaterThanOrEqual(2);

        const service = newService("Checked");
        await fillCreateForm(page, {
            ...service,
            url: service.url.replace("https:", "http:"),
        });
        await page.getByRole("button", { name: "Create Service" }).click();
        await expect(
            page.getByText(
                "Service URL must be an https URL, e.g. https://example.org/.",
            ),
        ).toBeVisible();
        expect(registrations).toBe(0);

        // the entries stay, to be corrected
        await page
            .getByRole("textbox", {
                name: "https://api.example.com/v1",
                exact: true,
            })
            .fill(service.url);
        await page.getByRole("button", { name: "Create Service" }).click();
        await expect(
            page.getByText(`Registered ${service.name}`),
        ).toBeVisible();
        expect(registrations).toBe(1);
    });

    test("users who may add types can add a new one", async ({ page }) => {
        await login(page, "owner");
        await openCreateForm(page);
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

    test("users choose a registered type if they may add no unused types", async ({
        page,
        browser,
    }) => {
        await addTesType(browser);
        // `GET /me` still says that they may add types
        await publishRules(page, { maxUnusedServiceTypes: 0 });
        await login(page, "owner");
        // the form follows the user and the rules once they are loaded
        const loaded = Promise.all([
            page.waitForResponse(`${registry}/me`),
            page.waitForResponse(`${registry}/service-info`),
        ]);
        await openCreateForm(page);
        await loaded;
        await expect(page.getByText(pendingNote)).toHaveCount(0);
        await page
            .getByRole("button", { name: "Select a service type" })
            .click();
        await expect(
            page.getByRole("option", { name: "org.ga4gh · tes · 1.1.0" }),
        ).toBeVisible();
        await expect(
            page.getByRole("option", { name: "Add new service type" }),
        ).toHaveCount(0);
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
                json: { ...me, mayAddServiceTypes: false },
            });
        });
        await login(page, "owner");
        // the form follows the user once it is loaded
        const me = page.waitForResponse(`${registry}/me`);
        await openCreateForm(page);
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
        const form = await openCreateForm(page);
        // in user mode, admins register services like other users
        await expect(
            form.getByRole("button", { name: "Select a service type" }),
        ).toBeVisible();
        await expectNoAdminFields(page);
        await form.getByRole("button", { name: "Close", exact: true }).click();
        await expect(form).toBeHidden();

        // the mode is switched outside the form
        await page.getByRole("button", { name: "User mode" }).click();
        await expect(
            page.getByRole("button", { name: "Admin mode" }),
        ).toBeVisible();
        await page.waitForLoadState("networkidle");
        await openCreateForm(page);
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

        await openCreateForm(page);
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

    test("unsaved input asks before the form is closed", async ({ page }) => {
        await login(page, "owner");
        let form = await openCreateForm(page);
        const name = page.getByRole("textbox", {
            name: "Enter a descriptive name for your service",
        });
        const unsaved = page.getByRole("alertdialog", {
            name: "Unsaved changes",
        });
        const close = () =>
            form.getByRole("button", { name: "Close", exact: true }).click();

        // what users answer when the browser asks before the page is left
        let asked = 0;
        page.on("dialog", (dialog) => {
            asked++;
            return dialog.accept();
        });
        // the form has loaded the user and the types
        await expect(page.getByText(pendingNote)).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Select a service type" }),
        ).toBeVisible();
        await name.fill("Not saved");
        await page.keyboard.press("Escape");
        await expect(unsaved).toBeVisible();
        await unsaved.getByRole("button", { name: "Stay" }).click();
        await expect(form).toBeVisible();
        await expect(name).toHaveValue("Not saved");

        await close();
        await unsaved.getByRole("button", { name: "Discard" }).click();
        await expect(form).toBeHidden();
        // the form starts empty again
        form = await openCreateForm(page);
        await expect(name).toHaveValue("");

        // nothing to ask after Reset
        await name.fill("Not saved");
        await page.getByRole("button", { name: "Reset" }).click();
        await expect(name).toHaveValue("");
        await close();
        await expect(form).toBeHidden();
        await expect(unsaved).toHaveCount(0);
        expect(asked).toBe(0);

        // the browser asks before the page is left with unsaved input (the
        // guard cancels `beforeunload`; Firefox shows no dialog to the tests)
        const leaving = () =>
            page.evaluate(() => {
                const event = new Event("beforeunload", { cancelable: true });
                window.dispatchEvent(event);
                return event.defaultPrevented;
            });
        expect(await leaving()).toBe(false);
        await openCreateForm(page);
        await name.fill("Not saved");
        expect(await leaving()).toBe(true);
    });

    test("the form stays open while it sends", async ({ page, browser }) => {
        await addTesType(browser);
        // the registry answers once the test lets it
        let answer = () => {};
        const answered = new Promise<void>((resolve) => {
            answer = resolve;
        });
        await page.route(`${registry}/services`, async (route) => {
            if (route.request().method() !== "POST") return route.fallback();
            await answered;
            return route.continue();
        });
        await login(page, "owner");
        const form = await openCreateForm(page);
        const service = newService("Sending");
        await fillCreateForm(page, service);
        const sent = page.waitForRequest(
            (request) =>
                request.method() === "POST" &&
                request.url() === `${registry}/services`,
        );
        await page.getByRole("button", { name: "Create Service" }).click();
        await sent;

        // neither closed nor discarded while the registry hasn't answered
        await page.keyboard.press("Escape");
        await form.getByRole("button", { name: "Close", exact: true }).click();
        await expect(form).toBeVisible();
        await expect(
            page.getByRole("alertdialog", { name: "Unsaved changes" }),
        ).toHaveCount(0);
        answer();
        await expect(
            page.getByText(`Registered ${service.name}`),
        ).toBeVisible();
        await expect(form).toBeHidden();
    });

    test("links to the create page open the form", async ({ page }) => {
        // guests are asked to log in, and come back to the form
        await page.goto("/dashboard/services/create");
        await page.waitForURL(/\/dashboard\/services$/);
        const form = page.getByRole("dialog", { name: "Register Service" });
        await expect(
            form.getByText("Log in to register a service"),
        ).toBeVisible();
        await expect(
            form.getByRole("link", { name: "Log in" }),
        ).toHaveAttribute(
            "href",
            "/auth/login?next=%2Fdashboard%2Fservices%2Fcreate",
        );
        await page.waitForLoadState("networkidle");

        await login(page, "owner");
        await page.goto("/dashboard/services/create");
        await page.waitForURL(/\/dashboard\/services$/);
        await expect(
            form.getByRole("button", { name: "Select a service type" }),
        ).toBeVisible();
    });

    test("the form fits small screens", async ({ page }) => {
        await login(page, "owner");
        await page.setViewportSize({ width: 360, height: 640 });
        const form = await openCreateForm(page);
        await expect(
            form.getByRole("button", { name: "Select a service type" }),
        ).toBeVisible();

        // it scrolls up and down, never sideways
        const size = await form.evaluate((el) => ({
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            right: el.getBoundingClientRect().right,
        }));
        expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
        expect(size.right).toBeLessThanOrEqual(360);
        expect(size.scrollHeight).toBeGreaterThan(size.clientHeight);
        const create = form.getByRole("button", { name: "Create Service" });
        await create.scrollIntoViewIfNeeded();
        await expect(create).toBeInViewport();
        expect(
            await page.evaluate(
                () =>
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
            ),
        ).toBe(true);
    });
});
