import { expect, login, test, users } from "./fixtures";

test.describe("login", () => {
    test("sets the security headers", async ({ page }) => {
        const response = await page.goto("/auth/login");
        const headers = response?.headers() ?? {};
        expect(headers["content-security-policy"]).toContain(
            "frame-ancestors 'none'",
        );
        expect(headers["content-security-policy"]).toContain(
            "connect-src 'self' http://localhost:8180",
        );
        expect(headers["x-frame-options"]).toBe("DENY");
        expect(headers["x-content-type-options"]).toBe("nosniff");
        expect(headers["x-powered-by"]).toBeUndefined();
    });

    test("logs in, keeps the session and logs out", async ({ page }) => {
        await login(page, "owner");
        const menu = page.getByRole("button", { name: users.owner.sub });
        await expect(menu).toContainText(users.owner.name);

        const session = (await page.context().cookies()).find(
            (val) => val.name === "id_token",
        );
        expect(session?.httpOnly).toBe(true);
        await page.reload();
        await expect(menu).toBeVisible();

        await menu.click();
        await page.getByRole("menuitem", { name: "Log out" }).click();
        await page.waitForURL(/\/auth\/login/);
        const names = (await page.context().cookies()).map((val) => val.name);
        expect(names).not.toContain("access_token");
        expect(names).not.toContain("id_token");
    });

    test("logs in with PKCE and a nonce", async ({ page }) => {
        const authorize = page.waitForRequest(/\/oidc\/authorize\?/);
        await login(page, "owner");
        const params = new URL((await authorize).url()).searchParams;
        expect(params.get("code_challenge_method")).toBe("S256");
        expect(params.get("code_challenge")).toMatch(/^[\w-]{43}$/);
        const nonce = params.get("nonce");
        expect(nonce).toMatch(/^[\w-]{43}$/);

        // the provider checked the code verifier, and the ID token is of
        // this login
        const cookies = await page.context().cookies();
        const idToken = cookies.find((val) => val.name === "id_token");
        const claims = JSON.parse(
            Buffer.from(
                idToken?.value.split(".")[1] ?? "",
                "base64url",
            ).toString(),
        );
        expect(claims.nonce).toBe(nonce);
        // the secrets of the login are used up
        for (const name of ["authState", "authVerifier", "authNonce"])
            expect(cookies.map((val) => val.name)).not.toContain(name);
    });

    test("rejects a forged callback", async ({ page }) => {
        await page.goto("/auth/api/callback?code=x&state=forged");
        await expect(page).toHaveURL(/\/auth\/error\?type=state/);
    });

    test("logs out only from the app's pages", async ({ page, baseURL }) => {
        await login(page, "owner");
        const sessionCookies = async () =>
            (await page.context().cookies())
                .map((val) => val.name)
                .filter((name) => ["access_token", "id_token"].includes(name));

        // the page's request context, with the session's cookies
        const forged = await page.request.post("/auth/api/logout", {
            headers: { Origin: "https://evil.example.org" },
            maxRedirects: 0,
        });
        expect(forged.status()).toBe(303);
        expect(forged.headers().location).toContain("type=logout-origin");
        expect(await sessionCookies()).toHaveLength(2);

        const own = await page.request.post("/auth/api/logout", {
            headers: { Origin: new URL(baseURL as string).origin },
            maxRedirects: 0,
        });
        expect(own.status()).toBe(303);
        expect(own.headers().location).not.toContain("type=logout-origin");
        expect(await sessionCookies()).toEqual([]);
    });
});
