import { expect, login, sessionCookie, test, users } from "./fixtures";

const sessionCookies = Object.values(sessionCookie);

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

    test("logs in, keeps the session and logs out at the provider", async ({
        page,
        baseURL,
    }) => {
        await login(page, "owner");
        const menu = page.getByRole("button", { name: users.owner.sub });
        await expect(menu).toContainText(users.owner.name);

        const cookies = await page.context().cookies();
        const session = cookies.find(
            (val) => val.name === sessionCookie.idToken,
        );
        expect(session?.httpOnly).toBe(true);
        await page.reload();
        await expect(menu).toBeVisible();

        // the provider ends its session too, and sends the user back
        const endSession = page.waitForRequest(/\/oidc\/endsession\?/);
        await menu.click();
        await page.getByRole("menuitem", { name: "Log out" }).click();
        const params = new URL((await endSession).url()).searchParams;
        expect(params.get("id_token_hint")).toBe(session?.value);
        expect(params.get("client_id")).toBe("cloud-registry-ui-e2e");
        expect(params.get("post_logout_redirect_uri")).toBe(
            new URL("/auth/login", baseURL).href,
        );
        await page.waitForURL(/\/auth\/login/);
        const names = (await page.context().cookies()).map((val) => val.name);
        for (const name of sessionCookies) expect(names).not.toContain(name);
    });

    test("keeps the session in __Host- cookies", async ({ page }) => {
        await login(page, "owner");
        const cookies = await page.context().cookies();
        for (const name of sessionCookies)
            expect(cookies.find((val) => val.name === name)).toMatchObject({
                secure: true,
                path: "/",
                sameSite: "Lax",
            });
        // read by the browser, which sends it to the registry
        expect(
            cookies.find((val) => val.name === sessionCookie.accessToken)
                ?.httpOnly,
        ).toBe(false);
    });

    test("keeps sessions of the old cookie names", async ({
        page,
        context,
    }) => {
        await login(page, "owner");
        // as 1.0.0-rc1 and earlier set them
        const cookies = await context.cookies();
        await context.clearCookies();
        await context.addCookies(
            cookies
                .filter((val) => sessionCookies.includes(val.name))
                .map(({ name, value, domain, httpOnly, expires }) => ({
                    name: name.replace(/^__Host-/, ""),
                    value,
                    domain,
                    path: "/",
                    httpOnly,
                    expires,
                    sameSite: "Lax" as const,
                })),
        );
        await page.goto("/dashboard");
        const menu = page.getByRole("button", { name: users.owner.sub });
        await expect(menu).toContainText(users.owner.name);

        // logging out deletes them
        await menu.click();
        await page.getByRole("menuitem", { name: "Log out" }).click();
        await page.waitForURL(/\/auth\/login/);
        const names = (await context.cookies()).map((val) => val.name);
        for (const name of ["access_token", "id_token", "login_provider"])
            expect(names).not.toContain(name);
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
        const idToken = cookies.find(
            (val) => val.name === sessionCookie.idToken,
        );
        const claims = JSON.parse(
            Buffer.from(
                idToken?.value.split(".")[1] ?? "",
                "base64url",
            ).toString(),
        );
        expect(claims.nonce).toBe(nonce);
        // the mock lists no token auth methods, so the app sent the client
        // ID only in the HTTP Basic header (client_secret_basic), from which
        // the mock took the audience
        expect(claims.aud).toEqual(["cloud-registry-ui-e2e"]);
        // the secrets of the login are used up
        for (const name of ["authState", "authVerifier", "authNonce"])
            expect(cookies.map((val) => val.name)).not.toContain(
                `__Host-${name}`,
            );
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
                .filter((name) =>
                    [sessionCookie.accessToken, sessionCookie.idToken].includes(
                        name,
                    ),
                );

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
        // on to the provider, to end its session too
        expect(own.headers().location).toContain("/oidc/endsession?");
        expect(await sessionCookies()).toEqual([]);
    });
});
