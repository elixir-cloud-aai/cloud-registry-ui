/**
 * @description names of the login's cookies, for the server and the
 * browser. In production, they have the prefix `__Host-`, with which
 * browsers take them only if they are `Secure`, for the path `/` and
 * without a `Domain`, so that sites on sibling subdomains can't set them
 * (e.g. to log users in to another account). Development servers run over
 * `http`, where such cookies can't be set, and use the plain names.
 */

/** @description cookies of a session */
const sessionCookies = ["access_token", "id_token", "login_provider"] as const;

type SessionCookie = (typeof sessionCookies)[number];

const hostPrefix = "__Host-";

/**
 * Whether cookies of the login are `Secure` and have the prefix `__Host-`;
 * Next inlines NODE_ENV in the browser's code
 * @returns Whether the app runs in production
 */
function secureCookies() {
    return process.env.NODE_ENV === "production";
}

/**
 * Get the name of a cookie of the login
 * @param name Plain name, e.g. `access_token`
 * @returns The name with the prefix `__Host-` in production, else as given
 */
function cookieName(name: string) {
    return secureCookies() ? `${hostPrefix}${name}` : name;
}

/**
 * Get the names that a cookie of the login may have: its name, and its
 * plain name, which 1.0.0-rc1 and earlier set in production too. Only the
 * current name is read (sessions of those versions end with the upgrade);
 * logging out and new logins delete both, so that no old cookie is left
 * @param name Plain name
 * @returns The names, the current one first
 */
function cookieNames(name: string) {
    const current = cookieName(name);
    return current === name ? [name] : [current, name];
}

/**
 * Read a cookie of the session, by its current name only (see
 * `cookieName()`): in production, a cookie of the plain name may have been
 * set by a site on a sibling subdomain
 * @param name Plain name
 * @param get Reads a cookie by name, e.g. `getCookie` of `cookies-next`
 * @returns The value, if it is set and not empty
 */
function sessionCookie(
    name: SessionCookie,
    get: (name: string) => string | undefined,
) {
    return get(cookieName(name)) || undefined;
}

export type { SessionCookie };
export {
    cookieName,
    cookieNames,
    secureCookies,
    sessionCookie,
    sessionCookies,
};
