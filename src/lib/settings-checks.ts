/**
 * @description checks of the public settings (`NEXT_PUBLIC_*`), in one
 * place for `next.config.ts` and `src/instrumentation.ts`
 */
import { accessSettings } from "./access-settings";
import { brandingSettings } from "./branding";
import { footerSettings } from "./footer-links";
import { registrySettings } from "./registry-settings";
import { servicesSortWarnings } from "./services-sort";

// settings that the app no longer reads, with what replaces them
const removedSettings = {
    NEXT_PUBLIC_SERVICE_ENVIRONMENTS: "environments",
    NEXT_PUBLIC_SERVICE_URL_SCHEMES: "URL schemes",
};

/**
 * Warn of removed settings that are still set; they are ignored
 */
function removedSettingsWarnings() {
    for (const [name, rule] of Object.entries(removedSettings))
        if (process.env[name] !== undefined)
            console.warn(
                `Ignoring setting ${name}: the app reads the allowed ${rule} of services from the registry's service info (registrationRules). Remove the setting.`,
            );
}

/**
 * Check the public settings; the login settings have their own checks
 * @throws Error naming the first missing or invalid setting
 */
function publicSettingsChecks() {
    registrySettings();
    accessSettings();
    brandingSettings();
    footerSettings();
    servicesSortWarnings();
    removedSettingsWarnings();
}

export { publicSettingsChecks };
