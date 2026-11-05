import { deleteCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { adminModeCookie } from "@/lib/admin-mode";
import { endedLoginCookies } from "@/lib/login-flow";
import {
    loginErrorSummary,
    loginProvider,
    loginSettings,
    oidcEndpoints,
} from "@/lib/login-providers";
import { deleteLoginCookies, readSessionCookie } from "@/lib/session";
import { sessionCookies } from "@/lib/session-cookies";

/**
 * Check that a request comes from the app's own pages
 * @param request Request
 * @param appOrigin The app's public origin
 * @returns Whether `Origin` is the app's, or, without a usable `Origin`
 * (missing, or `null`, e.g. with `Referrer-Policy: no-referrer`), the browser
 * says the request is from the same origin
 */
function fromApp(request: NextRequest, appOrigin: string) {
    const origin = request.headers.get("origin");
    if (origin !== null && origin !== "null") return origin === appOrigin;
    return request.headers.get("sec-fetch-site") === "same-origin";
}

/**
 * Get where to end the session at its provider (RP-Initiated Logout 1.0),
 * which then sends the user back to the app's login page
 * @param providerId Provider of the session, from its cookie
 * @param idToken ID token of the session, which tells the provider whose
 * session to end
 * @param appOrigin The app's public origin
 * @returns URL of the provider's end session endpoint, with the ID token,
 * the client ID and the login page; undefined without a session, if the
 * provider has no such endpoint, or if its discovery failed
 */
async function providerLogoutUrl(
    providerId: string | undefined,
    idToken: string | undefined,
    appOrigin: string,
) {
    if (!idToken) return undefined;
    // sessions without the provider's cookie, e.g. older ones, are of the
    // only provider, if there is one
    const provider = loginProvider(providerId);
    if (!provider) return undefined;
    let endpoint: string | undefined;
    try {
        endpoint = (await oidcEndpoints(provider)).end_session_endpoint;
    } catch (err) {
        console.error(
            `Logout at ${provider.id} skipped (logged out of the app only):`,
            loginErrorSummary(err),
        );
        return undefined;
    }
    if (!endpoint) return undefined;
    const url = new URL(endpoint);
    // keeps query parameters of the endpoint
    for (const [key, val] of Object.entries({
        id_token_hint: idToken,
        client_id: provider.clientId,
        post_logout_redirect_uri: new URL("/auth/login", appOrigin).href,
    }))
        url.searchParams.set(key, val);
    return url;
}

/**
 * Escape text for an HTML attribute value in double quotes
 * @param text Text, e.g. a URL
 * @returns The text with `&`, `"`, `<` and `>` as character references
 */
function htmlAttribute(text: string) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

/**
 * Send the browser on to the provider's end session endpoint with a page
 * that refreshes to it, not a redirect: browsers apply the Content Security
 * Policy's `form-action` to every redirect after the logout form, also to
 * those of the provider (e.g. through other hosts of a single logout), and
 * a refresh is a new navigation, not a form submission
 * @param url URL of the end session endpoint, with the ID token
 * @returns Page that the browser leaves at once, with a link as a fallback;
 * not stored, as the URL holds the ID token
 */
function continueAt(url: URL) {
    const href = htmlAttribute(url.href);
    return new NextResponse(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${href}"><title>Logging out</title></head><body><p><a href="${href}">Continue logging out at your login provider</a></p></body></html>`,
        {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer",
            },
        },
    );
}

/**
 * Log out: a POST from the app's own pages only, so that other sites and
 * prefetching can't log users out
 * @param request Request, a form submission
 * @returns Page that goes on to the provider's end session endpoint, if
 * it has one, which sends the user on to the login page; else a redirect
 * (303, so that the browser follows with a GET) to the login page, or to
 * the error page for requests from other origins
 */
export async function POST(request: NextRequest) {
    // the app's public origin, also behind a reverse proxy; absolute URLs, as
    // the redirects need the status 303
    const appOrigin = new URL(loginSettings().redirectUri).origin;
    if (!fromApp(request, appOrigin))
        return NextResponse.redirect(
            new URL("/auth/error?type=logout-origin", appOrigin),
            303,
        );

    let providerId: string | undefined;
    let idToken: string | undefined;
    try {
        providerId = await readSessionCookie("login_provider");
        idToken = await readSessionCookie("id_token");
        // by all their names, also those of earlier versions; a pending
        // login must not log the user in again
        await deleteLoginCookies([...sessionCookies, ...endedLoginCookies]);
        await deleteCookie(adminModeCookie, { cookies, path: "/" });
    } catch (err) {
        console.error("Logout failed:", loginErrorSummary(err));
        return NextResponse.redirect(
            new URL("/auth/error?type=logout-err", appOrigin),
            303,
        );
    }
    const providerLogout = await providerLogoutUrl(
        providerId,
        idToken,
        appOrigin,
    );
    if (providerLogout) return continueAt(providerLogout);
    return NextResponse.redirect(new URL("/auth/login", appOrigin), 303);
}
