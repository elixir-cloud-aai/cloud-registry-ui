/**
 * @description checks of the public settings (`NEXT_PUBLIC_*`), in one
 * place for `next.config.ts` and `src/instrumentation.ts`
 */
import { brandingSettings } from "./branding";
import { registrySettings } from "./registry-settings";
import { environmentSettings } from "./service-environments";

/**
 * Check the public settings; the login settings have their own checks
 * @throws Error naming the first missing or invalid setting
 */
function publicSettingsChecks() {
    registrySettings();
    brandingSettings();
    environmentSettings();
}

export { publicSettingsChecks };
