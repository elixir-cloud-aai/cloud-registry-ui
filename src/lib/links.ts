// mirrors httpUrl and contactUrl in services/update/_components/form-helper.ts
const webSchemes = ["http:", "https:"];

/**
 * Get a link target from service data, if its scheme is safe to link to:
 * http(s), and mailto if `mail` is set (e.g., for contact URLs)
 */
export function safeHref(
    value: string | undefined,
    mail = false,
): string | undefined {
    if (!value) return undefined;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return undefined;
    }
    const schemes = mail ? [...webSchemes, "mailto:"] : webSchemes;
    return schemes.includes(url.protocol) ? value : undefined;
}
