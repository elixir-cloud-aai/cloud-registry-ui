/**
 * @description the registry setting, `NEXT_PUBLIC_CLOUD_REGISTRY_URL`, read
 * when the server runs (see `public-settings.ts`); the registry's rules for
 * registrations come from its service info (`registration-rules.ts`)
 */
import { publicSetting } from "./public-settings";
import { isLocalHost } from "./secure-urls";

/**
 * Check the registry settings; invalid values stop the server
 * @throws Error naming the missing or invalid setting
 */
function registrySettings() {
    const url = publicSetting("NEXT_PUBLIC_CLOUD_REGISTRY_URL") ?? "";
    // for messages: without a user or password, which belong in no log
    const shown = url.replace(/\/\/[^/?#]*@/, "//***@");
    if (!url.trim())
        throw new Error(
            "Missing setting NEXT_PUBLIC_CLOUD_REGISTRY_URL: set it to the registry's API, e.g. https://registry.example.org/ga4gh/registry/v1",
        );
    if (url !== url.trim())
        throw new Error(
            `Invalid setting NEXT_PUBLIC_CLOUD_REGISTRY_URL: "${shown}" has spaces at the start or end`,
        );
    if (!URL.canParse(url))
        throw new Error(
            `Invalid setting NEXT_PUBLIC_CLOUD_REGISTRY_URL: "${shown}" is not an absolute URL`,
        );
    const parsed = new URL(url);
    const local = parsed.protocol === "http:" && isLocalHost(parsed.hostname);
    // the browser takes `https:host/path` as a path of the app's own site
    if (!url.toLowerCase().startsWith(`${parsed.protocol}//`))
        throw new Error(
            `Invalid setting NEXT_PUBLIC_CLOUD_REGISTRY_URL: "${shown}" needs "//" after the scheme`,
        );
    if (parsed.protocol !== "https:" && !local)
        throw new Error(
            `Invalid setting NEXT_PUBLIC_CLOUD_REGISTRY_URL: "${shown}" must be an https URL (http only for localhost)`,
        );
    if (
        parsed.username ||
        parsed.password ||
        url.includes("?") ||
        url.includes("#")
    )
        throw new Error(
            `Invalid setting NEXT_PUBLIC_CLOUD_REGISTRY_URL: "${shown}" must not have a user, password, query or fragment`,
        );
}

export { registrySettings };
