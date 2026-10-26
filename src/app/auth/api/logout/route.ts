import { deleteCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { loginErrorSummary, loginSettings } from "@/lib/login-providers";

/**
 * Log out: a POST from the app's own pages only (checked by `Origin`), so
 * that other sites and prefetching can't log users out
 * @param request Request, a form submission
 * @returns Redirect to the login page, or 403 for other origins
 */
export async function POST(request: NextRequest) {
    // the app's public origin, also behind a reverse proxy
    const appOrigin = new URL(loginSettings().redirectUri).origin;
    if (request.headers.get("origin") !== appOrigin)
        return NextResponse.json(
            { error: "Log out from the app's pages" },
            { status: 403 },
        );

    try {
        await deleteCookie("access_token", { cookies });
        await deleteCookie("id_token", { cookies });
        await deleteCookie("login_provider", { cookies });
        // a pending login must not log the user in again
        await deleteCookie("authState", { cookies });
        await deleteCookie("authProvider", { cookies });
    } catch (err) {
        console.error("Logout failed:", loginErrorSummary(err));
        return NextResponse.redirect(
            new URL("/auth/error?type=logout-err", appOrigin),
            303,
        );
    }
    // 303: the browser follows with a GET
    return NextResponse.redirect(new URL("/auth/login", appOrigin), 303);
}
