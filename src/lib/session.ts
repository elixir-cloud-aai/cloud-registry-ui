/**
 * @description the login's cookies on the server, by the names of
 * `session-cookies.ts`: reading the session, and deleting cookies by
 * all their names
 */
import { deleteCookie, setCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import {
    cookieName,
    cookieNames,
    type SessionCookie,
    secureCookies,
    sessionCookie,
} from "./session-cookies";

/**
 * Read a cookie of the session, also by its old name
 * @param name Plain name
 * @returns The value, or undefined if it isn't set
 */
async function readSessionCookie(name: SessionCookie) {
    const jar = await cookies();
    return sessionCookie(name, (val) => jar.get(val)?.value);
}

/**
 * Read a cookie of a pending login, by its current name only: cookies of
 * a pending login of an earlier version are ignored, and the user logs in
 * again
 * @param name Plain name
 * @returns The value, or undefined if it isn't set
 */
async function readLoginCookie(name: string) {
    return (await cookies()).get(cookieName(name))?.value || undefined;
}

/**
 * Set a cookie of the login, with the options that its name needs: for
 * the path `/`, without a domain, and `Secure` in production
 * @param name Plain name
 * @param value Value
 * @param options Lifetime in seconds, and whether only the server reads it
 */
async function setLoginCookie(
    name: string,
    value: string,
    options: { maxAge: number; httpOnly?: boolean },
) {
    await setCookie(cookieName(name), value, {
        cookies,
        secure: secureCookies(),
        sameSite: "lax",
        path: "/",
        ...options,
    });
}

/**
 * Delete cookies of the login by all their names; `Secure`, as browsers
 * ignore other changes of `__Host-` cookies
 * @param names Plain names
 */
async function deleteLoginCookies(names: readonly string[]) {
    for (const name of names)
        for (const val of cookieNames(name))
            await deleteCookie(val, {
                cookies,
                path: "/",
                secure: secureCookies(),
            });
}

export {
    deleteLoginCookies,
    readLoginCookie,
    readSessionCookie,
    setLoginCookie,
};
