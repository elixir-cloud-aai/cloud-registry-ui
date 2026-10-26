import { type NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "@/lib/security-headers";

/**
 * Set the Content Security Policy with a new nonce for each page; Next adds
 * the nonce to its scripts, and the layout passes it on (`x-nonce`)
 * @param request Request of a page
 * @returns The response, with the policy
 */
export function proxy(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const policy = contentSecurityPolicy(nonce);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);
    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", policy);
    return response;
}

// all routes but static files and the router's prefetches, which return
// no HTML; other paths that start like static files still get the policy
export const config = {
    matcher: [
        {
            source: "/((?!_next/static/|_next/image$|favicon\\.ico$).*)",
            missing: [{ type: "header", key: "next-router-prefetch" }],
        },
    ],
};
