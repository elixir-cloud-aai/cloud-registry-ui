import { safeHref } from "@/lib/links";

/**
 * Get the address of the registry's API, as the browser calls it
 * @param setting The base URL that the app is configured with
 * @param page Address of the current page, which relative settings resolve
 * against
 * @returns The absolute http(s) address, without a user, password or
 * trailing slashes;
 * undefined if the setting is missing or isn't such an address. The server
 * refuses to start with such a setting or a relative one, so these only
 * occur where the check doesn't run
 */
function apiAddress(
    setting: string | undefined,
    page: string,
): string | undefined {
    // with spaces, the calls go elsewhere than the address parsed here says
    if (!setting || setting !== setting.trim()) return undefined;
    if (!URL.canParse(setting, page)) return undefined;
    const url = new URL(setting, page);
    url.username = "";
    url.password = "";
    // as the calls use it (`authenticated-cloud-registry.ts`), so that adding
    // a path gives no `//`
    return safeHref(url.href.replace(/\/+$/, ""));
}

export { apiAddress };
