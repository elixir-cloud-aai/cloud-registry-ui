import { deleteCookie } from "cookies-next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    try {
        await deleteCookie("access_token", { cookies });
        await deleteCookie("id_token", { cookies });
    } catch (err) {
        console.log(err);
        redirect("/auth/error?state=logout-err");
    }
    redirect("/auth/login");
}
