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
    type Frame,
    type Locator,
    type Page,
    type Request,
    type Response,
} from "@playwright/test";

const registry = "http://localhost:8180/ga4gh/registry/v1";

/** Names of the session's cookies: the tests run the app in production
 * mode (`next start`, or the image), where they have the prefix `__Host-` */
const sessionCookie = {
    accessToken: "__Host-access_token",
    idToken: "__Host-id_token",
    loginProvider: "__Host-login_provider",
};

const adminGroup =
    "urn:geant:lifescience-ri.eu:group:elixir:ECP_CLN:ADMIN#aai.lifescience-ri.eu";

/** Test users: the mock provider puts the claims in tokens and user info;
 * `scripts/docs-screenshots.mjs` logs in the same way: keep it in step */
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
 * Whether a response is that of the read of the pending entries with the
 * token (`getApprovals()`), which the pages with lists start last: first,
 * the app may have to find out whether the registry has them
 * (`hasApprovals()`, which reads the service info, and may probe the route)
 * @param response Response
 * @returns Whether it is
 */
function isApprovalsRead(response: Response) {
    return (
        response.url() === `${registry}/approvals` &&
        !!response.request().headers().authorization
    );
}

/**
 * Match the responses of the reads of a path of the registry (GET, with or
 * without the token, whatever the query)
 * @param path Path below the API's base URL, exactly as the app requests
 * it (e.g. no trailing slash)
 * @returns Matcher of the responses
 */
function isRead(path: string) {
    return (response: Response) => {
        const { origin, pathname } = new URL(response.url());
        return (
            response.request().method() === "GET" &&
            `${origin}${pathname}` === `${registry}${path}`
        );
    };
}

/**
 * The reads that a service's page (`/dashboard/services/view/<id>`) starts
 * last: the service's verification and sync, once the service is read,
 * with the token also once the pending entries are read (see
 * `getServiceWithApproval()`)
 * @param id ID of the service
 * @returns Matchers for `waitForReads()`
 */
function serviceReads(id: string) {
    return [
        isRead(`/services/${id}/verification`),
        isRead(`/services/${id}/sync`),
    ];
}

/**
 * The reads that a service's edit form (`/dashboard/services/update/<id>`)
 * starts last: those of its page (`serviceReads()`), and the second read
 * of the pending entries, as the form reads them for the types too. For
 * one wait only, as the matchers count the reads
 * @param id ID of the service
 * @returns Matchers for `waitForReads()`
 */
function editFormReads(id: string) {
    let approvals = 0;
    return [
        ...serviceReads(id),
        (response: Response) => isApprovalsRead(response) && ++approvals === 2,
    ];
}

/**
 * Keep track of the reads of the registry that a page starts, until they
 * have ended: their responses have arrived in full, or they failed. A
 * response of a test's route (`page.route()`, which has no server address)
 * only needs to have arrived, as the route hands over the whole body at
 * once: Chromium reports it as finished only once the page reads the body,
 * which the app doesn't do for every response (e.g. for a 503 of the
 * service info in `hasApprovals()`). Not `response.finished()`, which
 * never settles for a response whose body is cut off, e.g. when the app
 * aborts the read. Reads of a document that the page left for another
 * site end then, as browsers may report nothing more about them
 * @param page Page
 * @returns `reads`: the reads so far; `stop()`: stop recording reads;
 * `ended()`: wait until the reads recorded so far have ended
 */
function trackReads(page: Page) {
    const reads: Request[] = [];
    const ends = new Map<Request, Promise<void>>();
    const pending = new Map<Request, () => void>();
    const end = (request: Request) => {
        pending.get(request)?.();
        pending.delete(request);
    };
    const record = (request: Request) => {
        if (!request.url().startsWith(registry)) return;
        reads.push(request);
        ends.set(
            request,
            new Promise<void>((resolve) => pending.set(request, resolve)),
        );
        request
            .response()
            .then(async (response) => {
                if (response && !(await response.serverAddr())) end(request);
            })
            .catch(() => end(request));
    };
    let origin = URL.canParse(page.url()) ? new URL(page.url()).origin : "";
    const navigated = (frame: Frame) => {
        if (frame !== page.mainFrame()) return;
        const now = new URL(frame.url()).origin;
        if (now !== origin)
            for (const request of [...pending.keys()]) end(request);
        origin = now;
    };
    const endAll = () => {
        for (const request of [...pending.keys()]) end(request);
    };
    page.on("request", record);
    page.on("requestfinished", end);
    page.on("requestfailed", end);
    page.on("framenavigated", navigated);
    page.on("close", endAll);
    return {
        reads,
        stop: () => page.off("request", record),
        ended: async () => {
            await Promise.all(reads.map((val) => ends.get(val)));
            if (pending.size === 0) {
                page.off("requestfinished", end);
                page.off("requestfailed", end);
                page.off("framenavigated", navigated);
                page.off("close", endAll);
            }
        },
    };
}

/**
 * Do something that makes the page read from the registry, and wait until
 * those reads have ended (see `trackReads()`): first for the given
 * responses to reads that started meanwhile, which show that the page has
 * started all of them, then for every read that started meanwhile. Firefox
 * fails reads that are still running when the test leaves the page (with
 * a `TypeError`, not an `AbortError`), and so may Chromium, and the app
 * logs them as errors. Not `waitForLoadState("networkidle")`: a page may
 * start its reads more than 500 ms after its scripts have loaded, and a
 * link changes the page without loading a document, whose network was
 * idle before; either way, the wait returns before the reads have started.
 * The reads of what the page did before must have ended (e.g. after a
 * save), as reads that it starts during the action would match, too
 * @param page Page
 * @param action What starts the reads, e.g. a click
 * @param last What the responses to wait for match: the reads that the
 * page starts last, e.g. `isApprovalsRead`
 * @returns The responses, in the order of `last`
 */
async function waitForReads(
    page: Page,
    action: () => Promise<unknown>,
    last: ((response: Response) => boolean)[],
) {
    const tracked = trackReads(page);
    // not the responses to reads of the page before, which may still run
    const started = (response: Response) =>
        tracked.reads.includes(response.request());
    let responses: Response[];
    try {
        const waits = Promise.all(
            last.map((val) =>
                page.waitForResponse((res) => started(res) && val(res)),
            ),
        );
        // awaited below, unless the action fails
        waits.catch(() => undefined);
        await action();
        responses = await waits;
    } finally {
        tracked.stop();
    }
    await tracked.ended();
    return responses;
}

/**
 * Open a page and wait until its reads have finished (see `waitForReads()`)
 * @param page Page
 * @param path Path of the page
 * @param last What the responses to wait for match, e.g. `isApprovalsRead`
 * @returns The responses, in the order of `last`
 */
async function openPage(
    page: Page,
    path: string,
    last: ((response: Response) => boolean)[],
) {
    return await waitForReads(page, () => page.goto(path), last);
}

/**
 * Log in through the login page and the mock provider's form
 * @param page Page
 * @param user Test user
 * @param options `adminMode`: switch to admin mode afterwards (admins only)
 * @returns The access token of the session
 */
async function login(page: Page, user: User, { adminMode = false } = {}) {
    const { sub, name, groups } = users[user];
    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Mock Login" }).click();
    await page.locator("input[name=username]").fill(sub);
    await page
        .locator("textarea[name=claims], input[name=claims]")
        .fill(JSON.stringify({ name, eduperson_entitlement: groups }));
    // the login ends on the Services page, which reads the same for every
    // user, and so does its reload by the switch to admin mode
    await waitForReads(page, () => page.locator("input[type=submit]").click(), [
        isApprovalsRead,
    ]);
    await page.waitForURL(/\/dashboard/);
    if (adminMode) {
        await waitForReads(
            page,
            () => page.getByRole("button", { name: "User mode" }).click(),
            [isApprovalsRead],
        );
        await expect(
            page.getByRole("button", { name: "Admin mode" }),
        ).toBeVisible();
    }
    const cookies = await page.context().cookies();
    const token = cookies.find(
        (val) => val.name === sessionCookie.accessToken,
    )?.value;
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
            // the verification or sync of a service without one (also when
            // "sync now" finds it turned off), and the
            // public read of a pending service, which the app repeats with
            // the token
            (status === "404" &&
                /^\/services\/[^/]+(\/verification|\/sync(\?onlyIfEnabled=true)?)?$/.test(
                    url.slice(registry.length),
                ) &&
                url.startsWith(registry)) ||
            // the pending entries, for users other than admins; the probe
            // for them without a token, for registries that publish no rules
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
    page.on("pageerror", (err) => {
        if (watched(page.url())) problems.push(`page error: ${err.message}`);
    });
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
            // admin mode, which grants nothing to users other than admins
            ...(token && {
                Authorization: `Bearer ${token}`,
                "X-Request-Roles": "admin",
            }),
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
 * Register the service type of `newService()`, if it isn't yet
 * @param browser Browser
 */
async function addTesType(browser: Browser) {
    // 409 if it exists already
    await api(
        await tokenOf(browser, "admin"),
        "POST",
        "/services/types",
        tesType,
    );
}

/**
 * Open the create form: the modal "Register Service" of the Services page.
 * The page is only opened if another one is shown: the login ends on it,
 * and opening it again would cut off its requests, which the app logs as
 * errors; when it is opened here, its reads are waited for
 * @param page Page of a logged-in user
 * @returns The modal
 */
async function openCreateForm(page: Page) {
    if (new URL(page.url()).pathname !== "/dashboard/services")
        await openPage(page, "/dashboard/services", [isApprovalsRead]);
    await page.getByRole("button", { name: "Register Service" }).click();
    const dialog = page.getByRole("dialog", { name: "Register Service" });
    await expect(dialog).toBeVisible();
    return dialog;
}

/**
 * Fill in the create form (see `openCreateForm()`) with a service of
 * `newService()`, choosing its type from the registered ones (see
 * `addTesType()`); the environment stays empty. The fields are found by
 * the placeholders of cloud-components 2.0.0-alpha.50
 * @param page Page with the form
 * @param service The service
 */
async function fillCreateForm(
    page: Page,
    service: ReturnType<typeof newService>,
) {
    const fields: [string, string][] = [
        ["Enter a descriptive name for your service", service.name],
        ["https://api.example.com/v1", service.url],
        ["Enter your organization name", service.organization.name],
        ["https://example.com", service.organization.url],
        ["1.0.0", service.version],
    ];
    for (const [name, value] of fields)
        await page.getByRole("textbox", { name, exact: true }).fill(value);
    // named by its placeholder once the types are loaded
    await page.getByRole("button", { name: "Select a service type" }).click();
    const { group, artifact, version } = service.type;
    await page
        .getByRole("option", { name: `${group} · ${artifact} · ${version}` })
        .click();
}

/**
 * Open the list of a select of the app (Radix UI's `Select`, e.g. "Service
 * Type" in the edit form) and wait until its options take clicks: once it
 * has moved the focus into the list, after placing it
 * @param combobox The select
 */
async function openList(combobox: Locator) {
    // by the keyboard: a list opened by a press of the pointer ignores the
    // next release of the pointer within 10 px of the press, and starts
    // watching for it only once it is shown, which under load may come
    // after the press was released; a click on an option could then be
    // taken for the end of that press, and ignored
    await combobox.focus();
    await combobox.press("Enter");
    await combobox
        .page()
        .waitForFunction(
            () => !!document.activeElement?.closest("[role=listbox]"),
        );
}

/**
 * Register a service as a user, with its type
 * @param browser Browser
 * @param user Owner of the new service
 * @param name Start of its name
 * @returns The service and its ID
 */
async function registerService(browser: Browser, user: User, name: string) {
    await addTesType(browser);
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

/**
 * Get the address of a new service with service info in the stack
 * (`e2e/stack/service-info.py`)
 * @returns `key`: what makes it unique, `address`: where the registry finds
 * its service info, `url`: the service's URL, as the registry cuts it from
 * the address; `name`: the name that it serves
 */
function serviceWithInfo() {
    const key = uniqueId();
    const url = `http://service-info:8191/${key}`;
    return {
        key,
        url,
        address: `${url}/service-info`,
        name: `Imported ${key}`,
    };
}

/**
 * Change what a service of the stack serves as its service info
 * @param key Its key, from `serviceWithInfo()`
 * @param change Fields that replace those of the document; `status`: answer
 * with that status instead
 */
async function changeServiceInfo(key: string, change: object) {
    const response = await fetch(`http://localhost:8191/${key}/service-info`, {
        method: "PUT",
        body: JSON.stringify(change),
    });
    expect(response.ok).toBe(true);
}

/**
 * Let the page see other registration rules than the registry's own
 * (`registrationRules` of `GET /service-info`)
 * @param page Page
 * @param rules Rules that replace the published ones
 */
async function publishRules(page: Page, rules: object) {
    await page.route(`${registry}/service-info`, async (route) => {
        const response = await route.fetch();
        const info = await response.json();
        await route.fulfill({
            response,
            json: {
                ...info,
                registrationRules: { ...info.registrationRules, ...rules },
            },
        });
    });
}

/**
 * Let requests of the page fail with a conflict, as the registry sends it
 * @param page Page
 * @param path Path below the API's base URL, whatever the query
 * @param method HTTP method of the requests to fail
 * @param code The registry's code for the conflict
 */
async function failWithConflict(
    page: Page,
    path: string,
    method: string,
    code: string,
) {
    const { origin, pathname } = new URL(`${registry}${path}`);
    await page.route(
        (url) => url.origin === origin && url.pathname === pathname,
        (route) =>
            route.request().method() === method
                ? route.fulfill({
                      status: 409,
                      contentType: "application/problem+json",
                      body: JSON.stringify({
                          title: "Conflict",
                          status: 409,
                          detail: "The registry's own detail.",
                          code,
                      }),
                  })
                : route.fallback(),
    );
}

export {
    addTesType,
    api,
    changeServiceInfo,
    editFormReads,
    expect,
    failWithConflict,
    fillCreateForm,
    isApprovalsRead,
    isRead,
    login,
    newService,
    openCreateForm,
    openList,
    openPage,
    publishRules,
    registerService,
    registry,
    serviceReads,
    serviceWithInfo,
    sessionCookie,
    test,
    tokenOf,
    uniqueId,
    users,
    waitForReads,
    watchPage,
};
