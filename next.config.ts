import type { NextConfig } from "next";
import {
    PHASE_DEVELOPMENT_SERVER,
    PHASE_PRODUCTION_BUILD,
    PHASE_PRODUCTION_SERVER,
} from "next/constants";
import { brandingSettings } from "./src/lib/branding";
import { loginSettings } from "./src/lib/login-providers";
import { environmentSettings } from "./src/lib/service-environments";

function nextConfig(phase: string): NextConfig {
    // login settings are read at runtime: check them when `next start` or
    // `next dev` loads this file; invalid settings stop the start
    if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_SERVER)
        loginSettings();
    // branding and environment settings are built into the app: check them
    // when `next build` or `next dev` loads this file; invalid settings stop
    // the build
    if (
        phase === PHASE_DEVELOPMENT_SERVER ||
        phase === PHASE_PRODUCTION_BUILD
    ) {
        brandingSettings();
        environmentSettings();
    }

    return {
        // the Docker image runs the standalone server (`NEXT_OUTPUT` is set
        // in the Dockerfile); `next start` doesn't work with it
        output:
            process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
    };
}

export default nextConfig;
