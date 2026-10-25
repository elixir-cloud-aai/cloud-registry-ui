import type { NextConfig } from "next";
import {
    PHASE_DEVELOPMENT_SERVER,
    PHASE_PRODUCTION_SERVER,
} from "next/constants";
import { loginSettings } from "./src/lib/login-providers";

function nextConfig(phase: string): NextConfig {
    // login settings are read at runtime: check them when `next start` or
    // `next dev` loads this file
    if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_SERVER)
        loginSettings();

    return {
        /* config options here */
    };
}

export default nextConfig;
