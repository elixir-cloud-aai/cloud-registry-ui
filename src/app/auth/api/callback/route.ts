import axios from "axios";
import { getCookie, setCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
    loginProvider,
    loginSettings,
    oidcEndpoints,
} from "@/lib/login-providers";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code === null || state === null) redirect("/auth/error?type=params");

    const authState = await getCookie("authState", { cookies });
    if (authState !== state) redirect("/auth/error?type=state");

    const providerId = await getCookie("authProvider", { cookies });
    const provider = providerId ? loginProvider(providerId) : undefined;
    if (!provider) redirect("/auth/error?type=provider");

    try {
        const { token_endpoint } = await oidcEndpoints(provider);
        const response = await axios.post(
            token_endpoint,
            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: loginSettings().redirectUri,
                client_id: provider.clientId,
                client_secret: provider.clientSecret,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                validateStatus: (status) => status === 200,
            },
        );

        if (response.status === 200) {
            setCookie("access_token", response.data.access_token, {
                cookies: cookies,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 12,
                path: "/",
            });
            setCookie("id_token", response.data.id_token, {
                cookies: cookies,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 12,
                path: "/",
            });
            setCookie("login_provider", provider.id, {
                cookies: cookies,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 12,
                path: "/",
            });
        }
    } catch (err) {
        console.log(err);
        redirect("/auth/error?type=internal");
    }

    redirect("/dashboard");
}
