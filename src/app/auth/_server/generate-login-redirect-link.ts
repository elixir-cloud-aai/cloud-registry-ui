"use server";
import { setCookie } from "cookies-next/server";
import { cookies } from "next/headers";

async function generateLoginRedirectLink() {
    const baseUrl = `${process.env.LS_LOGIN_URL}/oidc/authorize`;
    const authState = crypto.randomUUID();
    const scope = "openid profile email";

    await setCookie("authState", authState, {
        cookies: cookies,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 30,
        path: "/",
    });

    return (
        baseUrl +
        `?response_type=code&client_id=${process.env.OIDC_CLIENT_ID}&redirect_uri=${process.env.OIDC_REDIRECT_URI}` +
        `&scope=${scope}&state=${authState}`
    );
}

export default generateLoginRedirectLink;
