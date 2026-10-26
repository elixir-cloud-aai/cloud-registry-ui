/**
 * @description registry settings, `NEXT_PUBLIC_CLOUD_REGISTRY_URL` and
 * `NEXT_PUBLIC_SERVICE_URL_SCHEMES`, set at build time
 */

// schemes the registry can allow for service URLs
// (`custom.endpoints.services.url_schemes`)
const allowedSchemes = ["http", "https"];
// as the registry allows them, comma-separated; unset or empty for its
// default
const configuredSchemes = (process.env.NEXT_PUBLIC_SERVICE_URL_SCHEMES ?? "")
    .split(",")
    .map((scheme) => scheme.trim().toLowerCase())
    .filter(Boolean);
const serviceUrlSchemes = configuredSchemes.length
    ? configuredSchemes
    : ["https"];

/**
 * Check whether a host name is the local machine
 * @param hostname Host name of a URL, IPv6 addresses in brackets
 * @returns Whether it is `localhost`, a `.localhost` name or a loopback
 * address
 */
function isLocalHost(hostname: string) {
    return (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        /^127(\.\d{1,3}){3}$/.test(hostname) ||
        hostname === "[::1]"
    );
}

/**
 * Check the registry settings; invalid values stop the build
 * @throws Error naming the missing or invalid setting
 */
function registrySettings() {
    const url = process.env.NEXT_PUBLIC_CLOUD_REGISTRY_URL ?? "";
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

    const invalid = configuredSchemes.find(
        (scheme) => !allowedSchemes.includes(scheme),
    );
    if (invalid !== undefined)
        throw new Error(
            `Invalid setting NEXT_PUBLIC_SERVICE_URL_SCHEMES: "${invalid}" is not one of ${allowedSchemes.join(", ")}`,
        );
}

export { registrySettings, serviceUrlSchemes };
