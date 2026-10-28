import { deleteCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { adminModeCookie } from "@/lib/admin-mode";
import { loginCookies, returnCookie } from "@/lib/login-flow";
import { loginErrorSummary, loginSettings } from "@/lib/login-providers";

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
 * Log out: a POST from the app's own pages only, so that other sites and
 * prefetching can't log users out
 * @param request Request, a form submission
 * @returns Redirect (303, so that the browser follows with a GET) to the
 * login page, or to the error page for requests from other origins
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

    try {
        // the path the cookies were set with
        const options = { cookies, path: "/" };
        await deleteCookie("access_token", options);
        await deleteCookie("id_token", options);
        await deleteCookie("login_provider", options);
        await deleteCookie(adminModeCookie, options);
        // a pending login must not log the user in again
        for (const name of [...loginCookies, returnCookie])
            await deleteCookie(name, options);
    } catch (err) {
        console.error("Logout failed:", loginErrorSummary(err));
        return NextResponse.redirect(
            new URL("/auth/error?type=logout-err", appOrigin),
            303,
        );
    }
    return NextResponse.redirect(new URL("/auth/login", appOrigin), 303);
}
