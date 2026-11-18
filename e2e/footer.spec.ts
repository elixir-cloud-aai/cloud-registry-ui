import type { Page } from "@playwright/test";
import { expect, isRead, openPage, test } from "./fixtures";

// the links of `NEXT_PUBLIC_FOOTER_LINKS` in `playwright.config.ts` and in
// service `app` of `e2e/stack/compose.yaml`
const links = [
    { label: "Privacy notice", url: "https://example.org/privacy" },
    { label: "Imprint", url: "/imprint" },
    { label: "Contact", url: "mailto:support@example.org" },
];

/**
 * Check the footer's links
 * @param page Page that shows the footer
 */
async function expectLinks(page: Page) {
    const nav = page.getByRole("navigation", { name: "Legal and contact" });
    await expect(nav.getByRole("link")).toHaveText(
        links.map((val) => val.label),
    );
    for (const { label, url } of links)
        await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
            "href",
            url,
        );
    // other sites in a new tab, without access to the app's window
    const external = nav.getByRole("link", { name: "Privacy notice" });
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", "noopener noreferrer");
    await expect(
        nav.getByRole("link", { name: "Imprint" }),
    ).not.toHaveAttribute("target", /./);
}

test.describe("footer", () => {
    test("shows the links on the login page", async ({ page }) => {
        await page.goto("/auth/login");
        await expectLinks(page);
    });

    test("shows the links on the dashboard", async ({ page }) => {
        await openPage(page, "/dashboard/services", [isRead("/services")]);
        await expectLinks(page);
    });

    test("shows the links on the invitation page", async ({ page }) => {
        await page.goto("/invitations");
        await expectLinks(page);
    });

    test("shows the links on the error page", async ({ page }) => {
        await page.goto("/auth/error?type=state");
        await expectLinks(page);
    });
});
