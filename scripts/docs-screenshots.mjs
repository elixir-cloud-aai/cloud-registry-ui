/**
 * @description takes the screenshots of the user guide (`docs/images/`) in
 * the default branding, against the stack of the end-to-end tests
 * (`e2e/stack/compose.yaml`, with its mock login provider) and the app
 * started as in `playwright.config.ts`; see "Screenshots" in
 * `docs/development.md`. It adds example service types and services to the
 * registry once (if it lists no services yet), so use a registry of its
 * own, not one with real data.
 *
 * Settings (environment variables):
 * - `APP_URL`: the app (default: `http://localhost:3100`)
 * - `REGISTRY_URL`: the registry's API (default:
 *   `http://localhost:8180/ga4gh/registry/v1`)
 * - `LOGIN_NAME`: name of the mock provider on the login page (default:
 *   `Mock Login`)
 */
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const appUrl = process.env.APP_URL ?? "http://localhost:3100";
const registry =
    process.env.REGISTRY_URL ?? "http://localhost:8180/ga4gh/registry/v1";
const loginName = process.env.LOGIN_NAME ?? "Mock Login";
const outDir = new URL("../docs/images/", import.meta.url);
// size of the browser window; pages with long content are taken taller
const width = 1440;
const height = 900;

const adminGroup =
    "urn:geant:lifescience-ri.eu:group:elixir:ECP_CLN:ADMIN#aai.lifescience-ri.eu";
const teamGroup = "urn:geant:lifescience-ri.eu:group:example:compute-team";

/** Test users of the mock provider, as in `e2e/fixtures.ts` */
const users = {
    admin: {
        sub: "alice@lifescience-ri.eu",
        name: "Alice",
        groups: [adminGroup],
    },
    owner: { sub: "bob@lifescience-ri.eu", name: "Bob", groups: [teamGroup] },
    other: { sub: "carol@lifescience-ri.eu", name: "Carol", groups: [] },
};

const types = {
    tes: { group: "org.ga4gh", artifact: "tes", version: "1.1.0" },
    wes: { group: "org.ga4gh", artifact: "wes", version: "1.1.0" },
    trs: { group: "org.ga4gh", artifact: "trs", version: "2.0.1" },
    drs: { group: "org.ga4gh", artifact: "drs", version: "1.4.0" },
};
// added by a user other than an admin, so pending until an admin approves it
const newType = {
    group: "org.example",
    artifact: "workflow-index",
    version: "1.0.0",
};

/**
 * An example service
 * @param id Its ID (admins choose IDs)
 * @param name Its name
 * @param type Its service type
 * @param organization Name of its organization
 * @param environment Its environment
 * @param description Its description
 * @returns The service
 */
function service(id, name, type, organization, environment, description) {
    const host = `${id}.example.org`;
    return {
        id,
        name,
        type,
        description,
        organization: { name: organization, url: "https://example.org" },
        contactUrl: "mailto:support@example.org",
        documentationUrl: `https://${host}/docs`,
        environment,
        version: "1.0.0",
        url: `https://${host}/ga4gh/${type.artifact}/v1`,
    };
}

const services = [
    service(
        "tes-north",
        "TES North",
        types.tes,
        "North Compute Centre",
        "prod",
        "Task execution on the North Compute Centre's cluster.",
    ),
    service(
        "tes-south",
        "TES South",
        types.tes,
        "South Bioinformatics Institute",
        "prod",
        "Task execution for life science workflows.",
    ),
    service(
        "tes-south-test",
        "TES South (test)",
        types.tes,
        "South Bioinformatics Institute",
        "test",
        "Test instance of TES South; may be reset at any time.",
    ),
    service(
        "wes-north",
        "WES North",
        types.wes,
        "North Compute Centre",
        "prod",
        "Runs Nextflow and Snakemake workflows.",
    ),
    service(
        "trs-east",
        "Workflow Registry East",
        types.trs,
        "East Data Lab",
        "prod",
        "Tool and workflow descriptors.",
    ),
    service(
        "drs-east",
        "DRS East",
        types.drs,
        "East Data Lab",
        "staging",
        "Access to data objects.",
    ),
];
// verified by the admin
const verified = ["tes-north", "wes-north", "trs-east"];

/**
 * Call the registry's API
 * @param token Access token, if any (admin mode for admins)
 * @param method HTTP method
 * @param path Path below the API's base URL
 * @param body JSON body, if any
 * @returns Status and JSON body
 */
async function api(token, method, path, body) {
    const response = await fetch(`${registry}${path}`, {
        method,
        headers: {
            ...(token && {
                Authorization: `Bearer ${token}`,
                "X-Request-Roles": "admin",
            }),
            ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    // 409: the type or role exists already, e.g. on a second run
    const result = {
        status: response.status,
        body: text ? JSON.parse(text) : undefined,
    };
    if (response.status >= 400 && response.status !== 409)
        throw new Error(`${method} ${path}: ${response.status} ${text}`);
    return result;
}

/**
 * Log in through the login page and the mock provider's form
 * @param page Page
 * @param user Key of `users`
 * @returns The access token
 */
async function login(page, user) {
    const { sub, name, groups } = users[user];
    await page.goto(`${appUrl}/auth/login`);
    await page.getByRole("link", { name: loginName }).click();
    await page.locator("input[name=username]").fill(sub);
    await page
        .locator("textarea[name=claims], input[name=claims]")
        .fill(JSON.stringify({ name, eduperson_entitlement: groups }));
    await page.locator("input[type=submit]").click();
    await page.waitForURL(/\/dashboard/);
    await page.waitForLoadState("networkidle");
    const cookies = await page.context().cookies();
    return cookies.find((val) => val.name === "access_token")?.value;
}

/**
 * A new page in a context of its own, in the light colour scheme
 * @param browser Browser
 * @returns The page
 */
async function newPage(browser) {
    const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: "light",
        deviceScaleFactor: 1,
    });
    return context.newPage();
}

/**
 * Save a screenshot of the page, or of a part of it
 * @param target Page or locator
 * @param name File name without extension
 * @param tall Height of the window for this screenshot, for pages whose
 * content scrolls (the app scrolls within the page, so full-page
 * screenshots don't show more)
 */
async function shoot(target, name, tall) {
    const page = "page" in target ? target.page() : target;
    if (tall) await page.setViewportSize({ width, height: tall });
    // wait for the requests that the last action started
    await page.waitForLoadState("networkidle");
    // let transitions (dialogs, menus, toasts) finish
    await page.waitForTimeout(300);
    await target.screenshot({ path: new URL(`${name}.png`, outDir).pathname });
    if (tall) await page.setViewportSize({ width, height });
    console.log(`saved ${name}.png`);
}

/**
 * Add the example types and services, unless the registry has services
 * @param tokens Access tokens of the users
 */
async function seed(tokens) {
    const listed = await api(tokens.admin, "GET", "/services");
    if (listed.body.length) return;
    const adminId = (await api(tokens.admin, "GET", "/me")).body.user_id;
    const ownerId = (await api(tokens.owner, "GET", "/me")).body.user_id;
    const otherId = (await api(tokens.other, "GET", "/me")).body.user_id;
    for (const type of Object.values(types))
        await api(tokens.admin, "POST", "/services/types", type);
    for (const { id, ...val } of services) {
        await api(tokens.admin, "PUT", `/services/${id}`, val);
        const path = `/services/${id}/permissions`;
        await api(
            tokens.admin,
            "PUT",
            `${path}/${encodeURIComponent(ownerId)}`,
            { role: "owner" },
        );
        await api(
            tokens.admin,
            "DELETE",
            `${path}/${encodeURIComponent(adminId)}`,
        );
    }
    await api(
        tokens.admin,
        "PUT",
        `/services/tes-north/permissions/${encodeURIComponent(otherId)}`,
        {
            role: "maintainer",
        },
    );
    await api(
        tokens.owner,
        "PUT",
        `/services/tes-north/permissions/groups/${encodeURIComponent(teamGroup)}`,
        {
            role: "maintainer",
        },
    );
    for (const id of verified)
        await api(tokens.admin, "PUT", `/services/${id}/verification`);
    // a new type of a user other than an admin, and a service that has it
    await api(tokens.other, "POST", "/services/types", newType);
    const { id: _id, ...pending } = service(
        "workflow-index",
        "Workflow Index (pilot)",
        newType,
        "East Data Lab",
        "test",
        "Searchable index of public workflows.",
    );
    await api(tokens.other, "POST", "/services", pending);
}

const browser = await chromium.launch();
try {
    await mkdir(outDir, { recursive: true });
    const pages = {
        admin: await newPage(browser),
        owner: await newPage(browser),
        other: await newPage(browser),
    };
    const tokens = {};
    for (const user of Object.keys(pages))
        tokens[user] = await login(pages[user], user);
    await seed(tokens);

    // guests
    const guest = await newPage(browser);
    await guest.goto(`${appUrl}/auth/login`);
    await shoot(guest, "login");
    await guest.goto(`${appUrl}/dashboard/services`);
    await shoot(guest, "services-guest");
    await guest.goto(`${appUrl}/dashboard/service-info`);
    await shoot(guest, "service-info");

    // owners
    const owner = pages.owner;
    await owner.goto(`${appUrl}/dashboard/services`);
    await shoot(owner, "services");
    await owner.getByLabel("Search services").fill("tes");
    await owner.getByLabel("Filter by environment").click();
    await owner.getByRole("option", { name: "prod" }).click();
    await shoot(owner, "services-filtered");
    await owner.goto(`${appUrl}/dashboard/services`);
    await owner.getByRole("cell", { name: "tes-north", exact: true }).click();
    await shoot(owner.getByRole("dialog"), "service-details", 1300);
    await owner
        .getByRole("dialog")
        .getByRole("button", { name: "Manage access" })
        .click();
    await shoot(owner.getByRole("dialog").last(), "manage-access");
    // an invitation: the dialog with its link, and the page that the link
    // opens (for a user who is logged in); revoked afterwards, so that
    // runs leave no open invitations
    const access = owner.getByRole("dialog").last();
    // the open invitations before this run's
    await expect(
        access.getByRole("button", { name: "Create link" }),
    ).toBeEnabled();
    const before = await access
        .getByRole("button", { name: /^Revoke/ })
        .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    await access.getByRole("button", { name: "Create link" }).click();
    const link = await access
        .getByRole("textbox", { name: "Invitation link" })
        .inputValue();
    await shoot(access, "manage-access-invite", 1300);
    await pages.other.goto(link);
    await pages.other
        .getByRole("button", { name: "Accept invitation" })
        .waitFor();
    await shoot(pages.other, "accept-invitation");
    // the invitation of this run: the one that wasn't open before
    const revoke = access.getByRole("button", { name: /^Revoke/ });
    const labels = await revoke.evaluateAll((els) =>
        els.map((el) => el.getAttribute("aria-label")),
    );
    const mine = labels.filter((val) => !before.includes(val));
    if (mine.length !== 1)
        throw new Error(`expected one new invitation, found ${mine.length}`);
    await access.getByRole("button", { name: mine[0], exact: true }).click();
    await expect(revoke).toHaveCount(before.length);
    await owner.goto(`${appUrl}/dashboard/services/create`);
    await shoot(owner, "register-service");
    await owner.goto(`${appUrl}/dashboard/services/update/tes-north`);
    await shoot(owner, "edit-service");
    await owner.goto(`${appUrl}/dashboard/services`);
    await owner
        .locator("[data-sidebar=footer] [data-sidebar=menu-button]")
        .click();
    await shoot(owner, "user-menu");
    await owner.keyboard.press("Escape");

    // users with a pending service
    const other = pages.other;
    const pendingId = (await api(tokens.other, "GET", "/approvals")).body
        .services[0].id;
    await other.goto(`${appUrl}/dashboard/services/view/${pendingId}`);
    await shoot(other, "pending-service", 1300);
    await other.goto(`${appUrl}/dashboard/service-types`);
    await shoot(other, "service-types");

    // admins, in user mode and in admin mode
    const admin = pages.admin;
    await admin.goto(`${appUrl}/dashboard/services`);
    await shoot(admin.locator("header"), "user-mode");
    await admin.getByRole("button", { name: "User mode" }).click();
    await admin.getByRole("button", { name: "Admin mode" }).waitFor();
    await shoot(admin, "admin-mode");
    await admin.goto(`${appUrl}/dashboard/service-types`);
    await shoot(admin, "service-types-admin");
    await admin.goto(`${appUrl}/dashboard/services/view/tes-south`);
    await shoot(admin, "verify-service", 1300);
    await admin.goto(`${appUrl}/dashboard/services/view/${pendingId}`);
    await shoot(admin, "approve-service", 1300);
} finally {
    await browser.close();
}
