import { api, expect, login, registerService, test, tokenOf } from "./fixtures";

test.describe("manage access", () => {
    test("long lists of role holders page, and can be searched", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Crowded");
        // users who never used the registry, so without names, and a group;
        // as an admin, who may grant roles to any group
        const admin = await tokenOf(browser, "admin");
        const path = `/services/${encodeURIComponent(service.id)}/permissions`;
        const ids = Array.from(
            { length: 11 },
            (_, idx) =>
                `member-${String(idx + 1).padStart(2, "0")}@example.org`,
        );
        for (const id of ids)
            expect(
                (
                    await api(
                        admin,
                        "PUT",
                        `${path}/${encodeURIComponent(id)}`,
                        {
                            role: "maintainer",
                        },
                    )
                ).status,
            ).toBe(200);
        expect(
            (
                await api(admin, "PUT", `${path}/groups/example-team`, {
                    role: "owner",
                })
            ).status,
        ).toBe(200);

        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("button", { name: "Manage access" }).click();
        const dialog = page.getByRole("dialog");
        const holders = dialog.getByRole("button", { name: /^Remove / });
        // 13 holders: the owner, 11 users and a group, 8 per page
        const labels = () =>
            holders.evaluateAll((els) =>
                els.map((el) => el.getAttribute("aria-label")),
            );
        await expect(holders).toHaveCount(8);
        await expect(dialog.getByText("1–8 of 13")).toBeVisible();
        const first = await labels();
        await dialog.getByRole("link", { name: "2" }).click();
        await expect(holders).toHaveCount(5);
        await expect(dialog.getByText("9–13 of 13")).toBeVisible();
        // the other holders: all 13 once
        const second = await labels();
        expect(new Set([...first, ...second]).size).toBe(13);

        // users without a name show their ID alone
        const list = dialog.getByRole("table").first();
        await expect(
            list.getByRole("row", { name: /member-\d+@example\.org/ }).first(),
        ).toBeVisible();
        await expect(list.locator("tbody")).not.toContainText(/\bUser\b/);
        const search = dialog.getByRole("searchbox", {
            name: "Search users and groups",
        });
        await search.fill("MEMBER-07");
        await expect(holders).toHaveCount(1);
        await expect(
            dialog.getByRole("button", { name: `Remove ${ids[6]}` }),
        ).toBeVisible();
        await expect(dialog.getByText("1–1 of 1 (of 13)")).toBeVisible();
        // the owner, by name
        await search.fill("bob");
        await expect(dialog.getByText("Bob (you)")).toBeVisible();
        await search.fill("nobody");
        await expect(
            dialog.getByText("No users or groups match."),
        ).toBeVisible();
        await search.fill("");
        await expect(holders).toHaveCount(8);
    });
});
