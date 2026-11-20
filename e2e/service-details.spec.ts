import type { Browser, Locator, Page } from "@playwright/test";
import {
    api,
    expect,
    isApprovalsRead,
    isRead,
    login,
    newService,
    openPage,
    registerService,
    serviceReads,
    test,
    tokenOf,
    uniqueId,
    waitForReads,
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
 * The top of an element's box
 * @param locator The element
 * @returns Its top, in pixels
 */
async function topOf(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("The element isn't rendered");
    return box.y;
}

/**
 * Check that the service details fit their container: no sideways scrolling
 * and all buttons inside it; for an admin in admin mode viewing a pending
 * service, who gets all actions but Verify. The failed operations and
 * sharing sit at the top, next to the dialog's close button, if there is
 * one, and the actions on the service in one row at the bottom
 * @param page Page with the details
 * @param container The dialog or the card around the details
 */
async function expectFits(page: Page, container: Locator) {
    const header = [
        container.getByRole("link", {
            name: "Failed operations of this service",
        }),
        container.getByRole("button", { name: "Share link" }),
    ];
    const actions = [
        container.getByRole("button", { name: "Manage access" }),
        container.getByRole("button", { name: "Approve" }),
        container.getByRole("link", { name: "Edit" }),
        container.getByRole("button", { name: "Delete" }),
    ];
    for (const button of [...header, ...actions])
        await expect(button).toBeVisible();
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
    for (const button of [...header, ...actions]) {
        const buttonBox = await button.boundingBox();
        if (!buttonBox) throw new Error("A button isn't rendered");
        expect(buttonBox.x).toBeGreaterThanOrEqual(box.x);
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(
            box.x + box.width + 0.5,
        );
    }
    // one row each: the actions at the bottom, below the header's buttons
    const row = await topOf(actions[0]);
    for (const action of actions)
        expect(Math.abs((await topOf(action)) - row)).toBeLessThan(1);
    const top = await topOf(header[0]);
    expect(row).toBeGreaterThan(top);
    for (const button of header)
        expect(Math.abs((await topOf(button)) - top)).toBeLessThan(1);
    // in the dialog, sharing sits right next to its close button
    const close = container.getByRole("button", { name: "Close" });
    if ((await close.count()) > 0) {
        const share = await header[1].boundingBox();
        const closeBox = await close.boundingBox();
        if (!share || !closeBox) throw new Error("A button isn't rendered");
        expect(Math.abs(closeBox.y - share.y)).toBeLessThan(1);
        const gap = closeBox.x - (share.x + share.width);
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThanOrEqual(12);
    }
}

/**
 * Keep what the page copies, as not all browsers let tests read the
 * clipboard, or make copying fail
 * @param page Page, before it opens the app
 * @param fail Whether copying fails, as if the browser denied it
 */
async function watchClipboard(page: Page, fail = false) {
    await page.addInitScript((fail) => {
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: async (text: string) => {
                    if (fail) throw new Error("denied");
                    document.documentElement.dataset.copied = text;
                },
            },
        });
    }, fail);
}

/**
 * Open the details of a service in the dialog of the list
 * @param page Page, logged in or not
 * @param service The service
 * @returns The dialog
 */
async function openDialog(
    page: Page,
    service: { id: string; name: string; url: string },
) {
    await openPage(page, "/dashboard/services", [isApprovalsRead]);
    await page.getByLabel("Search services").fill(service.name);
    // the details read the service's sync: requests cut off by leaving the
    // page fail, and the app logs them
    await waitForReads(
        page,
        () => page.getByText(service.name, { exact: true }).click(),
        [isRead(`/services/${service.id}/sync`)],
    );
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(service.url);
    return dialog;
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

                await openPage(page, "/dashboard/services", [isApprovalsRead]);
                await page.getByLabel("Search services").fill(service.name);
                // the name's cell also holds the pending badge; the details
                // read the service's sync: requests cut off by leaving the
                // page fail, and the app logs them
                await waitForReads(
                    page,
                    () =>
                        page
                            .getByRole("cell", {
                                name: service.id,
                                exact: true,
                            })
                            .click(),
                    [isRead(`/services/${service.id}/sync`)],
                );
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

                await openPage(
                    page,
                    `/dashboard/services/view/${service.id}`,
                    serviceReads(service.id),
                );
                const card = page.locator("[data-slot=card]");
                await expect(card).toContainText("Service Details");
                await expectFits(page, card);
            });

    test("sharing copies the link, from next to the close button", async ({
        page,
        browser,
        baseURL,
    }) => {
        const service = await registerService(browser, "owner", "Shared");
        await watchClipboard(page);
        await login(page, "owner");
        const dialog = await openDialog(page, service);
        // focus starts on the dialog, without a tooltip; Tab leads to the
        // buttons at the top, in their order, each named by its tooltip
        await expect(dialog).toBeFocused();
        await expect(page.getByRole("tooltip")).toHaveCount(0);
        await page.keyboard.press("Tab");
        await expect(
            dialog.getByRole("link", {
                name: "Failed operations of this service",
            }),
        ).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(
            dialog.getByRole("button", { name: "Share link" }),
        ).toBeFocused();
        await expect(
            page.getByRole("tooltip", { name: "Share link" }),
        ).toBeVisible();
        await page.keyboard.press("Enter");
        await expect(
            page.getByText("Copied the link to this service."),
        ).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute(
            "data-copied",
            `${baseURL}/dashboard/services/view/${service.id}`,
        );
        await expect(
            dialog.getByRole("textbox", { name: "Link to this service" }),
        ).toHaveCount(0);
    });

    test("a link that can't be copied is shown below the title", async ({
        page,
        browser,
        baseURL,
    }) => {
        const service = await registerService(browser, "owner", "Uncopied");
        await watchClipboard(page, true);
        // also for guests, who have no actions on the service
        await openPage(
            page,
            `/dashboard/services/view/${service.id}`,
            serviceReads(service.id),
        );
        const card = page.locator("[data-slot=card]");
        await expect(card.getByRole("button", { name: "Delete" })).toHaveCount(
            0,
        );
        await card.getByRole("button", { name: "Share link" }).click();
        await expect(
            page.getByText(
                "Cannot copy the link. Copy it from the field below the title.",
            ),
        ).toBeVisible();
        const field = card.getByRole("textbox", {
            name: "Link to this service",
        });
        await expect(field).toHaveValue(
            `${baseURL}/dashboard/services/view/${service.id}`,
        );
        // right below the title, above the details
        expect(await topOf(field)).toBeLessThan(
            await topOf(card.getByText(service.url).first()),
        );
    });

    for (const [width, showsText] of [
        [360, false],
        [1280, true],
    ] as const)
        test(`access is named by its tooltip (${width} px)`, async ({
            page,
            browser,
        }) => {
            await page.setViewportSize({ width, height: 800 });
            const service = await registerService(browser, "owner", "Access");
            await login(page, "owner");
            await openPage(
                page,
                `/dashboard/services/view/${service.id}`,
                serviceReads(service.id),
            );
            const access = page.getByRole("button", { name: "Manage access" });
            // on phones, only the icon
            if (showsText)
                await expect(access.getByText("Access")).toBeVisible();
            else {
                await expect(access.getByText("Access")).toHaveCount(1);
                await expect(access.getByText("Access")).toBeHidden();
            }
            await access.hover();
            await expect(
                page.getByRole("tooltip", { name: "Manage access" }),
            ).toBeVisible();
            await access.click();
            await expect(
                page.getByRole("dialog").getByRole("tab", {
                    name: /^Current Access/,
                }),
            ).toBeVisible();
        });

    test("the actions of a verified service fit one row (360 px)", async ({
        page,
        browser,
    }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        const service = await registerService(browser, "owner", "Verified");
        await login(page, "admin", { adminMode: true });
        await openPage(
            page,
            `/dashboard/services/view/${service.id}`,
            serviceReads(service.id),
        );
        const card = page.locator("[data-slot=card]");
        await card.getByRole("button", { name: "Verify", exact: true }).click();
        // the longest label of the button, for an admin with all actions
        const actions = [
            card.getByRole("button", { name: "Manage access" }),
            card.getByRole("button", { name: "Unverify" }),
            card.getByRole("link", { name: "Edit" }),
            card.getByRole("button", { name: "Delete" }),
        ];
        for (const action of actions) await expect(action).toBeVisible();
        expect(await overflowing(card)).toEqual([]);
        const row = await topOf(actions[0]);
        for (const action of actions)
            expect(Math.abs((await topOf(action)) - row)).toBeLessThan(1);
    });
});
