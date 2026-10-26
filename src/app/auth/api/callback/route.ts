import axios from "axios";
import { deleteCookie, getCookie, setCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
    loginErrorSummary,
    loginProvider,
    loginRequestTimeout,
    loginSettings,
    oidcEndpoints,
} from "@/lib/login-providers";

// the tokens the app needs; the ID token marks the session as logged in,
// and the access token is sent as a bearer token, so it must be one
const tokenResponseSchema = z.object({
    access_token: z.string().min(1),
    id_token: z.string().min(1),
    token_type: z
        .string()
        .refine((val) => val.toLowerCase() === "bearer")
        .optional(),
});

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code === null || state === null) redirect("/auth/error?type=params");

    // a wrong state, e.g. from another site, leaves a pending login intact
    const authState = await getCookie("authState", { cookies });
    if (!authState || authState !== state) redirect("/auth/error?type=state");

    const providerId = await getCookie("authProvider", { cookies });
    // a state can be used once, also if this callback fails
    await deleteCookie("authState", { cookies, path: "/" });
    await deleteCookie("authProvider", { cookies, path: "/" });

    const provider = providerId ? loginProvider(providerId) : undefined;
    if (!provider) redirect("/auth/error?type=provider");

    let tokens: z.infer<typeof tokenResponseSchema>;
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
                timeout: loginRequestTimeout,
            },
        );
        const result = tokenResponseSchema.safeParse(response.data);
        // names the invalid fields, never their values
        if (!result.success) {
            const fields = result.error.issues.map(
                (issue) => issue.path.join(".") || "body",
            );
            throw new Error(`Invalid token response: ${fields.join(", ")}`);
        }
        tokens = result.data;
    } catch (err) {
        console.error(
            `Login with ${provider.id} failed:`,
            loginErrorSummary(err),
        );
        redirect("/auth/error?type=internal");
    }

    const cookieOptions = {
        cookies: cookies,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 60 * 60 * 12,
        path: "/",
    };
    // read by the browser, which sends it to the registry
    await setCookie("access_token", tokens.access_token, cookieOptions);
    // read on the server only
    await setCookie("id_token", tokens.id_token, {
        ...cookieOptions,
        httpOnly: true,
    });
    await setCookie("login_provider", provider.id, {
        ...cookieOptions,
        httpOnly: true,
    });

    redirect("/dashboard");
}
