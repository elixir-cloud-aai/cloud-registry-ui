import { setCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";
import { pkceChallenge, randomSecret } from "@/lib/login-flow";
import {
    loginErrorSummary,
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
        console.error(
            `Login with ${provider.id} failed:`,
            loginErrorSummary(err),
        );
        redirect("/auth/error?type=internal");
    }

    // secrets of this login, checked in the callback: the state, the PKCE
    // code verifier, which only this app can send with the code, and the
    // nonce, which the ID token must carry
    const authState = randomSecret();
    const verifier = randomSecret();
    const nonce = randomSecret();
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
    await setCookie("authVerifier", verifier, cookieOptions);
    await setCookie("authNonce", nonce, cookieOptions);

    const redirectUrl = new URL(authorizationEndpoint);
    // keeps query parameters of the endpoint
    for (const [key, val] of Object.entries({
        response_type: "code",
        client_id: provider.clientId,
        redirect_uri: loginSettings().redirectUri,
        scope: provider.scopes.join(" "),
        state: authState,
        code_challenge: pkceChallenge(verifier),
        code_challenge_method: "S256",
        nonce,
    }))
        redirectUrl.searchParams.set(key, val);

    return NextResponse.redirect(redirectUrl);
}
