/**
 * @description the links of the footer, e.g. to the privacy notice, the
 * terms of use and the imprint, from `NEXT_PUBLIC_FOOTER_LINKS` (a JSON
 * list), read when the server runs (see `public-settings.ts`). Each
 * deployment sets its own: the app has no default links, as their content
 * is the operator's. Checked without zod, as this module also runs in the
 * browser and in `next.config.ts` (see `zod.ts`)
 */
import { publicSetting } from "./public-settings";
import { isSecureUrl } from "./secure-urls";

type FooterLink = { label: string; url: string };

const maxLinks = 12;
const maxLabelLength = 60;
const urlMessage =
    "use an https URL, a mailto: address or a path of the app starting with /";

/**
 * Check the URL of a link
 * @param url URL
 * @returns Whether it is an `https` URL with a host (`http` only for the
 * local machine), a `mailto:` URL with an address, or a path of the app; no
 * whitespace or control characters, which browsers drop or change, and no
 * `//` or `/\` at the start of a path, which browsers read as another host
 */
function isLinkUrl(url: string) {
    if (/[\s\p{Cc}]/u.test(url)) return false;
    if (url.startsWith("/")) return !/^\/[/\\]/.test(url);
    if (/^mailto:/i.test(url))
        return /^mailto:[^?]/i.test(url) && URL.canParse(url);
    // `https:example.org` and `https:/example.org` parse, but browsers
    // read them as paths of the app
    return /^https?:\/\//i.test(url) && isSecureUrl(url);
}

/**
 * Tell whether a link leads to another site, so that it opens in a new tab
 * @param url URL of a valid link
 * @returns Whether it is an `http` or `https` URL
 */
function isExternalLink(url: string) {
    return /^https?:/i.test(url);
}

/**
 * Check one link of the setting
 * @param value The link, as parsed from JSON
 * @param n Its position, from 1
 * @returns The link, with the label trimmed, or an error
 */
function parseLink(
    value: unknown,
    n: number,
): { link: FooterLink; error?: undefined } | { error: string } {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return { error: `link ${n} must be an object with label and url` };
    const { label, url, ...rest } = value as Record<string, unknown>;
    const text = typeof label === "string" ? label.trim() : "";
    if (!text) return { error: `link ${n} needs a label` };
    const chars = [...text].length;
    if (chars > maxLabelLength)
        return {
            error: `link ${n} has a label of ${chars} characters; at most ${maxLabelLength} are allowed`,
        };
    const name = `link ${n} (${JSON.stringify(text)})`;
    const [unknown] = Object.keys(rest);
    if (unknown !== undefined)
        return {
            error: `${name} has the unknown key ${JSON.stringify(unknown)}; use label and url only`,
        };
    if (url === undefined) return { error: `${name} needs a url` };
    if (typeof url !== "string" || !isLinkUrl(url))
        return { error: `${name} has an invalid url: ${urlMessage}` };
    return { link: { label: text, url } };
}

/**
 * Parse the links of the footer
 * @param value Text of the setting, a JSON list of `{label, url}`; blank
 * counts as not set
 * @returns The links (none if not set), or an error naming the first
 * problem
 */
function parseFooterLinks(
    value = "",
): { links: FooterLink[]; error?: undefined } | { error: string } {
    const text = value.trim();
    if (!text) return { links: [] };
    let list: unknown;
    try {
        list = JSON.parse(text);
    } catch {
        return { error: "it is not valid JSON" };
    }
    if (!Array.isArray(list))
        return { error: "it must be a JSON list of links" };
    if (list.length > maxLinks)
        return {
            error: `it has ${list.length} links; at most ${maxLinks} are allowed`,
        };
    const links: FooterLink[] = [];
    for (const [i, item] of list.entries()) {
        const result = parseLink(item, i + 1);
        if (result.error !== undefined) return { error: result.error };
        links.push(result.link);
    }
    return { links };
}

/**
 * Get the links of the footer
 * @returns The setting `NEXT_PUBLIC_FOOTER_LINKS`, or no links if it isn't
 * set; invalid values stop the server first
 */
function footerLinks() {
    const result = parseFooterLinks(publicSetting("NEXT_PUBLIC_FOOTER_LINKS"));
    return result.error === undefined ? result.links : [];
}

/**
 * Check the links of the footer; invalid values stop the server
 * @throws Error naming the setting and the problem
 */
function footerSettings() {
    const { error } = parseFooterLinks(
        publicSetting("NEXT_PUBLIC_FOOTER_LINKS"),
    );
    if (error !== undefined)
        throw new Error(`Invalid setting NEXT_PUBLIC_FOOTER_LINKS: ${error}`);
}

export { footerLinks, footerSettings, isExternalLink, parseFooterLinks };
