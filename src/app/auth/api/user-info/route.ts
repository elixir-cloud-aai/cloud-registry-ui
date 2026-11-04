import axios from "axios";
import { getCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
    loginErrorSummary,
    loginProvider,
    loginRequestTimeout,
    oidcEndpoints,
} from "@/lib/login-providers";

export async function GET() {
    const accessToken = await getCookie("access_token", { cookies });
    if (!accessToken)
        return NextResponse.json({ error: true, user: null }, { status: 401 });
    const providerId = await getCookie("login_provider", { cookies });

    try {
        // sessions without the cookie, e.g. older ones, use the only provider
        const provider = loginProvider(providerId);
        if (!provider) throw new Error("Unknown login provider");
        const { userinfo_endpoint } = await oidcEndpoints(provider);
        const res = await axios.get(userinfo_endpoint, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
            timeout: loginRequestTimeout,
        });

        if (!res.data || typeof res.data !== "object") {
            throw new Error("Invalid JSON response");
        }

        return NextResponse.json({ error: false, user: res.data });
    } catch (err) {
        // expired or revoked tokens (401) are expected, other failures not
        if (!axios.isAxiosError(err) || err.response?.status !== 401)
            console.error("User info failed:", loginErrorSummary(err));
        return NextResponse.json({ error: true, user: null }, { status: 401 });
    }
}
