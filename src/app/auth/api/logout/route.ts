import { deleteCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    try {
        await deleteCookie("access_token", { cookies });
        await deleteCookie("id_token", { cookies });
        await deleteCookie("login_provider", { cookies });
        // a pending login must not log the user in again
        await deleteCookie("authState", { cookies });
        await deleteCookie("authProvider", { cookies });
    } catch (err) {
        console.log(err);
        redirect("/auth/error?type=logout-err");
    }
    redirect("/auth/login");
}
