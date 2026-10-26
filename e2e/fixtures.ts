/**
 * @description fixtures of the end-to-end tests: test users, login through
 * the mock provider, registry calls with a user's token, and a check that
 * no page breaks the Content Security Policy or throws
 */
import {
    type Browser,
    test as base,
    expect,
    type Page,
} from "@playwright/test";

const registry = "http://localhost:8180/ga4gh/registry/v1";

const adminGroup =
    "urn:geant:lifescience-ri.eu:group:elixir:ECP_CLN:ADMIN#aai.lifescience-ri.eu";

/** Test users: the mock provider puts the claims in tokens and user info */
const users = {
    admin: {
        sub: "alice@lifescience-ri.eu",
        name: "Alice",
        groups: [adminGroup],
    },
    owner: { sub: "bob@lifescience-ri.eu", name: "Bob", groups: [] },
    other: { sub: "carol@lifescience-ri.eu", name: "Carol", groups: [] },
};
type User = keyof typeof users;

/**
 * Log in through the login page and the mock provider's form
 * @param page Page
 * @param user Test user
 * @returns The access token of the session
 */
async function login(page: Page, user: User) {
    const { sub, name, groups } = users[user];
    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Mock Login" }).click();
    await page.locator("input[name=username]").fill(sub);
    await page
        .locator("textarea[name=claims], input[name=claims]")
        .fill(JSON.stringify({ name, eduperson_entitlement: groups }));
    await page.locator("input[type=submit]").click();
    await page.waitForURL(/\/dashboard/);
    const cookies = await page.context().cookies();
    const token = cookies.find((val) => val.name === "access_token")?.value;
    expect(token).toBeTruthy();
    return token as string;
}

/**
 * Get a user's access token in a context of its own
 * @param browser Browser
 * @param user Test user
 * @returns The access token
 */
async function tokenOf(browser: Browser, user: User) {
    const context = await browser.newContext();
    try {
        return await login(await context.newPage(), user);
    } finally {
        await context.close();
    }
}

type Fixtures = {
    /** Problems in the browser, which fail the test: CSP violations and
     * page errors */
    problems: string[];
};

const test = base.extend<Fixtures>({
    // for every test, also those that don't use the list
    problems: [
        async ({ page }, use) => {
            const problems: string[] = [];
            page.on("console", (msg) => {
                const text = msg.text();
                // Firefox notes that 'self' is ignored next to 'strict-dynamic',
                // the intended fallback for older browsers
                if (/Ignoring .'self'. within script-src/.test(text)) return;
                if (/Content.Security.Policy|Refused to/i.test(text))
                    problems.push(`CSP: ${text}`);
            });
            page.on("pageerror", (err) =>
                problems.push(`page error: ${err.message}`),
            );
            await use(problems);
            expect(problems).toEqual([]);
        },
        { auto: true },
    ],
});

/**
 * Call the registry's API as a user
 * @param token Access token, from `login()`
 * @param method HTTP method
 * @param path Path below the API's base URL
 * @param body JSON body, if any
 * @returns The response's status and JSON body, if any
 */
async function api(
    token: string | undefined,
    method: string,
    path: string,
    body?: unknown,
) {
    const response = await fetch(`${registry}${path}`, {
        method,
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return {
        status: response.status,
        body: text ? JSON.parse(text) : undefined,
    };
}

/** The service type of `newService()`, which only admins can add */
const tesType = { group: "org.ga4gh", artifact: "tes", version: "1.1.0" };

/**
 * A service to register, with a unique name and URL
 * @param name Start of the name
 * @returns The service
 */
function newService(name: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
        name: `${name} ${id}`,
        url: `https://${id}.tes.example.org/ga4gh/tes/v1`,
        type: tesType,
        organization: { name: "E2E Org", url: "https://example.org" },
        version: "1.0.0",
        environment: "test",
    };
}

/**
 * Register a service as a user, with its type
 * @param browser Browser
 * @param user Owner of the new service
 * @param name Start of its name
 * @returns The service and its ID
 */
async function registerService(browser: Browser, user: User, name: string) {
    const admin = await tokenOf(browser, "admin");
    // 409 if it exists already
    await api(admin, "POST", "/services/types", tesType);
    const service = newService(name);
    const created = await api(
        await tokenOf(browser, user),
        "POST",
        "/services",
        service,
    );
    expect(created.status).toBe(201);
    return { ...service, id: String(created.body) };
}

export {
    api,
    expect,
    login,
    newService,
    registerService,
    registry,
    tesType,
    test,
    tokenOf,
    users,
};
