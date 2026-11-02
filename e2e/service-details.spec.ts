import type { Browser, Locator, Page } from "@playwright/test";
import {
    api,
    expect,
    login,
    newService,
    test,
    tokenOf,
    uniqueId,
} from "./fixtures";

/**
 * Whether an element scrolls sideways, i.e. its content is wider than it
 * @param locator The element
 * @returns Whether it scrolls sideways
 */
function scrollsSideways(locator: Locator) {
    return locator.evaluate((el) => el.scrollWidth > el.clientWidth);
}

/**
 * Find what doesn't fit in a container: elements inside it that scroll
 * sideways (e.g. a body or the raw metadata), or stick out of it on either
 * side, where they would be clipped; elements hidden to the eye (e.g.
 * labels for screen readers) are 1 px wide and skipped
 * @param container The container
 * @returns The start of the HTML of each element that doesn't fit
 */
function overflowing(container: Locator) {
    return container.evaluate((root) => {
        const { left, right } = root.getBoundingClientRect();
        return Array.from(root.querySelectorAll("*"))
            .filter((el) => {
                const box = el.getBoundingClientRect();
                return (
                    el.clientWidth > 1 &&
                    (el.scrollWidth > el.clientWidth + 1 ||
                        box.left < left - 0.5 ||
                        box.right > right + 0.5)
                );
            })
            .map((el) => el.outerHTML.slice(0, 160));
    });
}

/**
 * Check that the service details fit their container: no sideways scrolling
 * and all actions inside it; for an admin in admin mode viewing a pending
 * service, who gets all actions but Verify
 * @param page Page with the details
 * @param container The dialog or the card around the details
 */
async function expectFits(page: Page, container: Locator) {
    const actions = [
        container.getByRole("button", { name: "Approve" }),
        container.getByRole("button", { name: "Share" }),
        container.getByRole("button", { name: "Manage access" }),
        container.getByRole("link", { name: "Edit" }),
        container.getByRole("button", { name: "Delete" }),
    ];
    for (const action of actions) await expect(action).toBeVisible();
    expect(await scrollsSideways(container)).toBe(false);
    expect(await overflowing(container)).toEqual([]);
    expect(
        await page.evaluate(
            () =>
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth,
        ),
    ).toBe(false);
    const box = await container.boundingBox();
    if (!box) throw new Error("The details aren't rendered");
    for (const action of actions) {
        const actionBox = await action.boundingBox();
        if (!actionBox) throw new Error("An action isn't rendered");
        expect(actionBox.x).toBeGreaterThanOrEqual(box.x);
        expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(
            box.x + box.width + 0.5,
        );
    }
}

/**
 * Register a pending service, as its type is new, with long values: name,
 * URL, a group of the type longer than a phone is wide, and an organization
 * name without delimiters
 * @param browser Browser
 * @returns The service and its ID
 */
async function registerPending(browser: Browser) {
    const id = uniqueId();
    const service = {
        ...newService("A rather long name of a pending service (test)"),
        organization: {
            name: "Averylongorganizationnamewithoutanyspacesordelimitersatall",
            url: "https://example.org",
        },
        url: `https://a-rather-long-host-name-${id}.example.org/ga4gh/registry/v1/services/some/very/long/path`,
        type: {
            group: "org.example.institute.department.registry.group.of.services",
            artifact: `e2e-${id}`,
            version: "1.0.0",
        },
    };
    const created = await api(
        await tokenOf(browser, "owner"),
        "POST",
        "/services",
        service,
    );
    expect(created.status).toBe(201);
    return { ...service, id: String(created.body) };
}

test.describe("service details", () => {
    for (const colorScheme of ["light", "dark"] as const)
        for (const [width, height] of [
            [360, 740],
            [1280, 800],
        ])
            test(`fit the dialog and the page (${colorScheme}, ${width} px)`, async ({
                page,
                browser,
            }) => {
                await page.emulateMedia({ colorScheme });
                await page.setViewportSize({ width, height });
                const service = await registerPending(browser);
                await login(page, "admin", { adminMode: true });

                await page.goto("/dashboard/services");
                await page.getByLabel("Search services").fill(service.name);
                // the name's cell also holds the pending badge
                await page
                    .getByRole("cell", { name: service.id, exact: true })
                    .click();
                const dialog = page.getByRole("dialog");
                await expect(
                    dialog.getByRole("heading", { name: "Service Details" }),
                ).toBeVisible();
                await expect(dialog).toContainText(
                    `Complete metadata of the service ${service.id}.`,
                );
                await expect(dialog).toContainText(service.url);
                await expectFits(page, dialog);
                // the confirmation of an approval fits, too
                await dialog.getByRole("button", { name: "Approve" }).click();
                const confirm = page.getByRole("alertdialog");
                await expect(
                    confirm.getByText(service.type.group),
                ).toBeVisible();
                expect(await scrollsSideways(confirm)).toBe(false);
                expect(await overflowing(confirm)).toEqual([]);
                await confirm.getByRole("button", { name: "Cancel" }).click();
                await page.keyboard.press("Escape");
                // requests cut off by leaving the page fail, and the app
                // logs them
                await page.waitForLoadState("networkidle");

                await page.goto(`/dashboard/services/view/${service.id}`);
                await page.waitForLoadState("networkidle");
                const card = page.locator("[data-slot=card]");
                await expect(card).toContainText("Service Details");
                await expectFits(page, card);
            });
});
