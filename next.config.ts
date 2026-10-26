import type { NextConfig } from "next";
import {
    PHASE_DEVELOPMENT_SERVER,
    PHASE_PRODUCTION_BUILD,
    PHASE_PRODUCTION_SERVER,
} from "next/constants";
import { brandingSettings } from "./src/lib/branding";
import { loginSettings } from "./src/lib/login-providers";
import { registrySettings } from "./src/lib/registry-settings";
import { securityHeaders } from "./src/lib/security-headers";
import { environmentSettings } from "./src/lib/service-environments";

function nextConfig(phase: string): NextConfig {
    // login settings are read at runtime: check them when `next start` or
    // `next dev` loads this file; invalid settings stop the start. The
    // standalone server of the Docker image doesn't load this file:
    // `src/instrumentation.ts` checks them there. Vercel builds
    // (`VERCEL=1`) have the runtime settings too, and deploy what they
    // build without starting it first: check them there when building
    if (
        phase === PHASE_DEVELOPMENT_SERVER ||
        phase === PHASE_PRODUCTION_SERVER ||
        (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL === "1")
    )
        loginSettings();
    // the other settings are built into the app: check them when
    // `next build` or `next dev` loads this file; invalid settings stop the
    // build
    if (
        phase === PHASE_DEVELOPMENT_SERVER ||
        phase === PHASE_PRODUCTION_BUILD
    ) {
        registrySettings();
        brandingSettings();
        environmentSettings();
    }

    return {
        poweredByHeader: false,
        // on all responses; the Content Security Policy is set per page by
        // `src/proxy.ts`
        headers: async () => [{ source: "/:path*", headers: securityHeaders }],
        // the Docker image runs the standalone server (`NEXT_OUTPUT` is set
        // in the Dockerfile); `next start` doesn't work with it
        output:
            process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
    };
}

export default nextConfig;
