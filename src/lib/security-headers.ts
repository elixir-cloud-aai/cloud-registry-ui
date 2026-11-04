/**
 * @description security headers of the app's pages: the Content Security
 * Policy (set per request by `src/proxy.ts`, as it needs a nonce) and the
 * headers of all responses (set in `next.config.ts`)
 */
import { publicSetting } from "./public-settings";

/** @description headers of all responses */
const securityHeaders = [
    // no MIME type sniffing, e.g. of uploaded or user-supplied content
    { key: "X-Content-Type-Options", value: "nosniff" },
    // the origin only for other sites; keeps `Origin` on same-origin POSTs,
    // which the logout check needs (`no-referrer` would send `null`)
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // no framing, for browsers without `frame-ancestors`
    { key: "X-Frame-Options", value: "DENY" },
];

/**
 * Get the origin of a URL
 * @param url URL, e.g. of the registry
 * @returns The origin, or undefined for a missing or invalid URL
 */
function originOf(url?: string) {
    return url && URL.canParse(url) ? new URL(url).origin : undefined;
}

/**
 * Build the Content Security Policy of a page
 * @param nonce Random value of this request, for Next's and the theme's
 * inline scripts
 * @returns The policy, as the value of the `Content-Security-Policy` header
 */
function contentSecurityPolicy(nonce: string) {
    const development = process.env.NODE_ENV === "development";
    const registry = originOf(publicSetting("NEXT_PUBLIC_CLOUD_REGISTRY_URL"));
    const directives: Record<string, (string | undefined)[]> = {
        "default-src": ["'self'"],
        // scripts with the nonce, and the scripts they load; React needs
        // `eval` for error stacks in development only. Scripts that Vercel
        // injects into preview deployments (the toolbar) are blocked
        "script-src": [
            "'self'",
            `'nonce-${nonce}'`,
            "'strict-dynamic'",
            development ? "'unsafe-eval'" : undefined,
        ],
        // inline styles of components and libraries (e.g. toasts, web
        // components); a nonce here would disable `'unsafe-inline'`
        "style-src": ["'self'", "'unsafe-inline'"],
        // logos may be URLs (branding, login providers)
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "data:"],
        // the app's routes and the registry, which the browser calls
        "connect-src": ["'self'", registry],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        // the app can't be framed, e.g. for clickjacking admin actions
        "frame-ancestors": ["'none'"],
    };
    return Object.entries(directives)
        .map(([name, values]) => [name, ...values.filter(Boolean)].join(" "))
        .join("; ");
}

export { contentSecurityPolicy, securityHeaders };
