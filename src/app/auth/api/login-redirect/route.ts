import { setCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";
import {
    loginProvider,
    loginSettings,
    oidcEndpoints,
} from "@/lib/login-providers";

export async function GET(request: NextRequest) {
    const provider = loginProvider(
        request.nextUrl.searchParams.get("provider") ?? undefined,
    );
    if (!provider) redirect("/auth/error?type=provider");

    let authorizationEndpoint: string;
    try {
        authorizationEndpoint = (await oidcEndpoints(provider))
            .authorization_endpoint;
    } catch (err) {
        console.log(err);
        redirect("/auth/error?type=internal");
    }

    const authState = crypto.randomUUID();
    const cookieOptions = {
        cookies: cookies,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 60 * 30,
        path: "/",
    };
    await setCookie("authState", authState, cookieOptions);
    await setCookie("authProvider", provider.id, cookieOptions);

    const redirectUrl = new URL(authorizationEndpoint);
    // keeps query parameters of the endpoint
    for (const [key, val] of Object.entries({
        response_type: "code",
        client_id: provider.clientId,
        redirect_uri: loginSettings().redirectUri,
        scope: provider.scopes.join(" "),
        state: authState,
    }))
        redirectUrl.searchParams.set(key, val);

    return NextResponse.redirect(redirectUrl);
}
