/**
 * @description helpers for tests of the auth routes: a cookie store in
 * place of `next/headers`, redirects of `next/navigation` as errors, and
 * login settings for a mock provider
 */
import axios from "axios";
import { vi } from "vitest";

type Cookie = { name: string; value: string; [option: string]: unknown };

/** Cookies of the request; what the route sets or deletes changes them */
const jar = new Map<string, Cookie>();
/** Every cookie the route set, also deleted ones (`maxAge: -1`) */
const setCookies: Cookie[] = [];

const cookieStore = {
    getAll: () => [...jar.values()],
    get: (name: string) => jar.get(name),
    set: (cookie: Cookie) => {
        setCookies.push(cookie);
        if (cookie.maxAge === -1) jar.delete(cookie.name);
        else jar.set(cookie.name, cookie);
    },
};

/** Error that the mocked `redirect()` throws */
class Redirect extends Error {
    constructor(readonly url: string) {
        super(`Redirect to ${url}`);
    }
}

const provider = {
    id: "mock",
    name: "Mock",
    logo: "/mock.svg",
    issuer: "https://login.example.org/oidc",
    clientId: "client",
    clientSecret: "client-secret",
};
const appOrigin = "https://app.example.org";
const discovery = {
    issuer: provider.issuer,
    authorization_endpoint: `${provider.issuer}/authorize?prompt=login`,
    token_endpoint: `${provider.issuer}/token`,
    userinfo_endpoint: `${provider.issuer}/userinfo`,
};

/**
 * Start a test: request cookies, the login settings, fresh modules, and
 * the provider's discovery document
 * @param cookies Cookies of the request, by name (undefined: not set)
 */
function setUp(cookies: Record<string, string | undefined> = {}) {
    vi.resetModules();
    jar.clear();
    setCookies.length = 0;
    for (const [name, value] of Object.entries(cookies))
        if (value !== undefined) jar.set(name, { name, value });
    vi.stubEnv("LOGIN_PROVIDERS", JSON.stringify([provider]));
    vi.stubEnv("LOGIN_REDIRECT_URI", `${appOrigin}/auth/api/callback`);
    vi.spyOn(axios, "get").mockImplementation(async (url) => {
        if (url.endsWith("/.well-known/openid-configuration"))
            return { data: discovery };
        throw new Error(`Unexpected GET ${url}`);
    });
}

/**
 * Run a route and get where it redirects with `redirect()`
 * @param run Call of the route
 * @returns The redirect's URL
 * @throws Error if the route returns instead
 */
async function redirectOf(run: () => Promise<unknown>) {
    try {
        await run();
    } catch (err) {
        if (err instanceof Redirect) return err.url;
        throw err;
    }
    throw new Error("The route didn't redirect");
}

export {
    appOrigin,
    cookieStore,
    discovery,
    jar,
    provider,
    Redirect,
    redirectOf,
    setCookies,
    setUp,
};
