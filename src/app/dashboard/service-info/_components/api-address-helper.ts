import { safeHref } from "@/lib/links";

/**
 * Get the address of the registry's API, as the browser calls it
 * @param setting The base URL that the app is configured with
 * @param page Address of the current page, which relative settings resolve
 * against
 * @returns The absolute http(s) address, without a user or password;
 * undefined if the setting is missing or isn't such an address. The server
 * refuses to start with such a setting or a relative one, so these only
 * occur where the check doesn't run
 */
function apiAddress(
    setting: string | undefined,
    page: string,
): string | undefined {
    if (!setting?.trim() || !URL.canParse(setting, page)) return undefined;
    const url = new URL(setting, page);
    url.username = "";
    url.password = "";
    // a bare origin gets a "/", which calls would double: `https://x//service-info`
    const added = url.href.endsWith("/") && !setting.trim().endsWith("/");
    return safeHref(added ? url.href.slice(0, -1) : url.href);
}

export { apiAddress };
