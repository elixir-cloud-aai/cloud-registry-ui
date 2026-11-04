import { describe, expect, it, vi } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

function directives(policy: string) {
    return Object.fromEntries(
        policy.split("; ").map((val) => {
            const [name, ...values] = val.split(" ");
            return [name, values];
        }),
    );
}

describe("securityHeaders", () => {
    it("sets the headers of all responses", () => {
        expect(
            Object.fromEntries(securityHeaders.map((h) => [h.key, h.value])),
        ).toEqual({
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "X-Frame-Options": "DENY",
        });
    });
});

describe("contentSecurityPolicy", () => {
    it("allows scripts with the nonce, the registry, and no framing", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv(
            "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
            "https://registry.example.org:8443/ga4gh/registry/v1",
        );
        const policy = directives(contentSecurityPolicy("abc"));
        expect(policy["script-src"]).toEqual([
            "'self'",
            "'nonce-abc'",
            "'strict-dynamic'",
        ]);
        expect(policy["connect-src"]).toEqual([
            "'self'",
            "https://registry.example.org:8443",
        ]);
        expect(policy["frame-ancestors"]).toEqual(["'none'"]);
        expect(policy["object-src"]).toEqual(["'none'"]);
        expect(policy["form-action"]).toEqual(["'self'"]);
        expect(policy["base-uri"]).toEqual(["'self'"]);
    });

    it("allows eval in development only", () => {
        vi.stubEnv("NODE_ENV", "development");
        expect(directives(contentSecurityPolicy("n"))["script-src"]).toContain(
            "'unsafe-eval'",
        );
    });

    it("connects to the app only without a valid registry URL", () => {
        for (const url of [undefined, "", "/relative"]) {
            vi.stubEnv("NEXT_PUBLIC_CLOUD_REGISTRY_URL", url);
            expect(
                directives(contentSecurityPolicy("n"))["connect-src"],
            ).toEqual(["'self'"]);
        }
    });
});
