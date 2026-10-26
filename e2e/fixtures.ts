/**
 * @description fixtures of the end-to-end tests: test users, login through
 * the mock provider, registry calls with a user's token, and a check that
 * no page breaks the Content Security Policy, throws, logs errors or fails
 * requests
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
    // Firefox fails the dashboard's requests that are still running when the
    // test moves on to another page, and the app logs them as errors
    await page.waitForLoadState("networkidle");
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
    /** Problems in the browser, which fail the test: CSP violations, page
     * errors, logged errors and failed requests */
    problems: string[];
};

/**
 * Whether a console message is one that the app causes on purpose
 * @param text Text of the message
 * @param url URL that the message is about, e.g. of a failed request
 * @returns Whether to ignore it
 */
function expectedMessage(text: string, url: string) {
    // browsers log failed requests even if the app handles them
    const status =
        /Failed to load resource: the server responded with a status of (\d+)/.exec(
            text,
        )?.[1];
    if (status)
        return (
            // e.g. the verification of a service without one
            (status === "404" && url.startsWith(registry)) ||
            // the pending entries, for users other than admins
            (["401", "403"].includes(status) &&
                url === `${registry}/approvals`) ||
            // the user of guests
            (status === "401" && url.endsWith("/auth/api/user-info"))
        );
    // Firefox notes that 'self' is ignored next to 'strict-dynamic', the
    // intended fallback for older browsers
    return /Ignoring .'self'. within script-src/.test(text);
}

/**
 * Collect the problems of a page: CSP violations, page errors, logged
 * errors, failed requests and server errors of the app and the registry
 * (not of the login provider's pages)
 * @param page Page
 * @param appURL Base URL of the app
 * @returns The list of problems, which grows while the page runs
 */
function watchPage(page: Page, appURL: string) {
    const problems: string[] = [];
    const watched = (url: string) =>
        [appURL, registry].some(
            (val) => new URL(val).origin === new URL(url).origin,
        );
    page.on("console", (msg) => {
        const text = msg.text();
        // Firefox gives some messages a location that isn't a URL
        const location = msg.location().url;
        const url = URL.canParse(location) ? location : page.url();
        if (!watched(url) || expectedMessage(text, url)) return;
        if (/Content.Security.Policy|Refused to/i.test(text))
            problems.push(`CSP: ${text}`);
        else if (msg.type() === "error")
            problems.push(`console error: ${text} (${url})`);
    });
    page.on("pageerror", (err) => problems.push(`page error: ${err.message}`));
    page.on("requestfailed", (request) => {
        if (!watched(request.url())) return;
        const failure = request.failure()?.errorText ?? "";
        // navigations and prefetches that a later one replaced
        if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(failure)) return;
        problems.push(`failed request: ${request.url()} ${failure}`);
    });
    page.on("response", (response) => {
        if (watched(response.url()) && response.status() >= 500)
            problems.push(
                `server error: ${response.status()} ${response.url()}`,
            );
    });
    return problems;
}

const test = base.extend<Fixtures>({
    // for every test, also those that don't use the list; tests that cause
    // problems on purpose check and clear it
    problems: [
        async ({ page, baseURL }, use) => {
            const problems = watchPage(page, baseURL as string);
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

/**
 * An ID that no other test run uses, for names in the shared registry
 * @returns The ID
 */
function uniqueId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The service type of `newService()`, which only admins can add */
const tesType = { group: "org.ga4gh", artifact: "tes", version: "1.1.0" };

/**
 * A service to register, with a unique name and URL
 * @param name Start of the name
 * @returns The service
 */
function newService(name: string) {
    const id = uniqueId();
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
    test,
    tokenOf,
    uniqueId,
    users,
    watchPage,
};
