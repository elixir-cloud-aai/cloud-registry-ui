"use server";
import axios from "axios";
import { setCookie } from "cookies-next/server";
import { cookies } from "next/headers";

async function exchangeCodeForToken(code: string) {
    const baseUrl = `${process.env.LS_LOGIN_URL}/oidc/token`;
    const response = await axios.post(
        baseUrl,
        new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: process.env.OIDC_REDIRECT_URI ?? "",
            client_id: process.env.OIDC_CLIENT_ID ?? "",
            client_secret: process.env.OIDC_CLIENT_SECRET ?? "",
        }),
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        },
    );

    if (response.status === 200) {
        setCookie("access_token", response.data.access_token, {
            cookies: cookies,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 12,
            path: "/",
        });
        setCookie("id_token", response.data.id_token, {
            cookies: cookies,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 12,
            path: "/",
        });
    }
}

export default exchangeCodeForToken;
