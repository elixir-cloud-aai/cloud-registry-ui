import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
    const accessToken = request.cookies.get("access_token")?.value;
    const idToken = request.cookies.get("id_token")?.value;

    if (!accessToken || !idToken) {
        return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: "/dashboard/:path*",
};
