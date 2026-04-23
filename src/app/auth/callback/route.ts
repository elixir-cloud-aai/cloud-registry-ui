import { getCookie } from "cookies-next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { exchangeCodeForToken } from "../_server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code === null || state === null) redirect("/auth/error?type=params");

    const authState = await getCookie("authState", { cookies });
    if (authState !== state) redirect("/auth/error?type=state");

    try {
        await exchangeCodeForToken(code);
    } catch (err) {
        console.log(err);
        redirect("/auth/error?type=internal");
    }

    redirect("/dashboard");
}
