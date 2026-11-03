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
                        `${path}/users/${encodeURIComponent(id)}`,
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
        // 13 holders: the owner, 11 users and a group, 5 per page
        const labels = () =>
            holders.evaluateAll((els) =>
                els.map((el) => el.getAttribute("aria-label")),
            );
        await expect(holders).toHaveCount(5);
        await expect(dialog.getByText("1–5 of 13")).toBeVisible();
        const first = await labels();
        await dialog.getByRole("link", { name: "2" }).click();
        await expect(dialog.getByText("6–10 of 13")).toBeVisible();
        const second = await labels();
        await dialog.getByRole("link", { name: "3" }).click();
        await expect(holders).toHaveCount(3);
        await expect(dialog.getByText("11–13 of 13")).toBeVisible();
        // the other holders: all 13 once
        const third = await labels();
        expect(new Set([...first, ...second, ...third]).size).toBe(13);

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
        await expect(holders).toHaveCount(5);
    });

    test("user IDs with slashes, or like the path of groups, get roles", async ({
        page,
        browser,
    }) => {
        const service = await registerService(browser, "owner", "Slashes");
        const owner = await tokenOf(browser, "owner");
        const path = `/services/${encodeURIComponent(service.id)}/permissions`;
        const ids = [
            "https://login.example.org/users/7",
            "groups",
            "groups/team-lead",
        ];
        const held = async () =>
            (await api(owner, "GET", path)).body.map(
                (val: { user_id?: string; group?: string }) =>
                    val.user_id ?? `group:${val.group}`,
            );
        const before = await held();

        await login(page, "owner");
        await page.goto(`/dashboard/services/view/${service.id}`);
        await page.getByRole("button", { name: "Manage access" }).click();
        const dialog = page.getByRole("dialog");
        // exact, as the name of one is the start of that of another
        const removal = (id: string) =>
            dialog.getByRole("button", { name: `Remove ${id}`, exact: true });
        for (const id of ids) {
            await dialog.getByLabel("User ID").fill(id);
            await dialog.getByRole("button", { name: "Grant" }).click();
            await expect(removal(id)).toBeVisible();
        }
        // these users, and neither groups nor users with a prefix of the path
        expect((await held()).sort()).toEqual([...before, ...ids].sort());

        for (const id of ids) {
            await removal(id).click();
            await expect(removal(id)).toHaveCount(0);
        }
        expect((await held()).sort()).toEqual([...before].sort());
    });
});
