import axios from "axios";
import { NextResponse } from "next/server";
import {
    loginErrorSummary,
    loginProvider,
    loginRequestOptions,
    oidcEndpoints,
} from "@/lib/login-providers";
import { readSessionCookie } from "@/lib/session";

/**
 * Answer that there is no logged-in user
 * @returns Response with status 401
 */
function loggedOut() {
    return NextResponse.json({ error: true, user: null }, { status: 401 });
}

export async function GET() {
    const accessToken = await readSessionCookie("access_token");
    if (!accessToken) return loggedOut();
    const providerId = await readSessionCookie("login_provider");

    try {
        // sessions without the cookie (in production, none since the
        // __Host- names; on development servers, those of versions before
        // login providers) use the only
        // provider; with several providers, and for providers that were
        // removed, they are logged out, which is expected after such
        // changes: no error. Their cookies stay, as a late answer could
        // otherwise delete those of a new login
        const provider = loginProvider(providerId);
        if (!provider) return loggedOut();
        const { userinfo_endpoint } = await oidcEndpoints(provider);
        const res = await axios.get(userinfo_endpoint, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
            ...loginRequestOptions,
        });

        if (!res.data || typeof res.data !== "object") {
            throw new Error("Invalid JSON response");
        }

        return NextResponse.json({ error: false, user: res.data });
    } catch (err) {
        // expired or revoked tokens (401) are expected, other failures not
        if (!axios.isAxiosError(err) || err.response?.status !== 401)
            console.error("User info failed:", loginErrorSummary(err));
        return loggedOut();
    }
}
