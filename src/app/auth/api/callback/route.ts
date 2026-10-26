import axios from "axios";
import { deleteCookie, getCookie, setCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { checkIdToken, loginCookies } from "@/lib/login-flow";
import {
    loginErrorSummary,
    loginProvider,
    loginRequestTimeout,
    loginSettings,
    oidcEndpoints,
} from "@/lib/login-providers";
import { z } from "@/lib/zod";

// the tokens the app needs; the ID token marks the session as logged in,
// and the access token is sent as a bearer token, so it must be one
const tokenResponseSchema = z.object({
    access_token: z.string().min(1),
    id_token: z.string().min(1),
    token_type: z
        .string()
        .refine((val) => val.toLowerCase() === "bearer")
        .optional(),
    // lifetime of the access token, in seconds (a number, or a string with
    // one), or null; a value under 1 second fails the login, as the token
    // is expired
    expires_in: z
        .union([z.number(), z.string().trim().min(1)])
        .pipe(z.coerce.number<string | number>().min(1))
        .transform(Math.floor)
        .nullish(),
});

// longest session, also for tokens that live longer or don't say how long
const maxSessionAge = 60 * 60 * 12;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // a wrong state, e.g. from another site, leaves a pending login intact;
    // so does a login without PKCE or nonce, e.g. of an earlier version
    const authState = await getCookie("authState", { cookies });
    const verifier = await getCookie("authVerifier", { cookies });
    const nonce = await getCookie("authNonce", { cookies });
    if (state === null || !authState || authState !== state)
        redirect("/auth/error?type=state");
    if (!verifier || !nonce) redirect("/auth/error?type=state");

    const providerId = await getCookie("authProvider", { cookies });
    // a state can be used once, also if this callback fails or the provider
    // sends an error (e.g. a denied login) instead of a code
    for (const name of loginCookies)
        await deleteCookie(name, { cookies, path: "/" });
    if (code === null) redirect("/auth/error?type=params");

    const provider = providerId ? loginProvider(providerId) : undefined;
    if (!provider) redirect("/auth/error?type=provider");

    let endpoints: Awaited<ReturnType<typeof oidcEndpoints>>;
    try {
        endpoints = await oidcEndpoints(provider);
    } catch (err) {
        console.error(
            `Login with ${provider.id} failed:`,
            loginErrorSummary(err),
        );
        redirect("/auth/error?type=internal");
    }

    // the response must come from the provider of this login, if it names
    // its issuer, and must name it if the provider says it does (RFC 9207):
    // otherwise, the code may be another provider's (a mix-up attack)
    const iss = searchParams.get("iss");
    if (
        iss === null
            ? endpoints.issParameterSupported
            : iss !== endpoints.issuer
    ) {
        // issuers aren't secret; `loginErrorSummary` makes the text safe
        console.error(
            `Login with ${provider.id} failed:`,
            loginErrorSummary(
                new Error(
                    `Unexpected iss ${iss ?? "(none)"}, expected ${endpoints.issuer}`,
                ),
            ),
        );
        redirect("/auth/error?type=issuer");
    }

    let tokens: z.infer<typeof tokenResponseSchema>;
    try {
        const response = await axios.post(
            endpoints.token_endpoint,
            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: loginSettings().redirectUri,
                client_id: provider.clientId,
                client_secret: provider.clientSecret,
                code_verifier: verifier,
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
        // the ID token must be of this login, not a replayed one
        checkIdToken(result.data.id_token, {
            issuer: endpoints.issuer,
            clientId: provider.clientId,
            nonce,
        });
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
        // the session ends with the access token, which the registry
        // rejects afterwards
        maxAge: Math.min(tokens.expires_in ?? maxSessionAge, maxSessionAge),
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
