/**
 * @description the settings of the "Manage Access" dialog, read when the
 * server runs (see `public-settings.ts`)
 */
import { publicSetting } from "./public-settings";

const defaultPageSize = 5;

/**
 * Parse a page size
 * @param value Text of the setting; blank counts as not set
 * @returns The page size, the default if not set, or undefined if invalid
 */
function parsePageSize(value = "") {
    const text = value.trim();
    if (!text) return defaultPageSize;
    const size = Number(text);
    return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(size)
        ? size
        : undefined;
}

/**
 * Get the entries per page of both tables of the dialog, the users and
 * groups with a role and the invitations
 * @returns The setting `NEXT_PUBLIC_ACCESS_PAGE_SIZE`, or the default
 * if it isn't set; invalid values stop the server first
 */
function accessPageSize() {
    return (
        parsePageSize(publicSetting("NEXT_PUBLIC_ACCESS_PAGE_SIZE")) ??
        defaultPageSize
    );
}

/**
 * Check the settings of the dialog; invalid values stop the server
 * @throws Error naming the invalid setting
 */
function accessSettings() {
    const value = publicSetting("NEXT_PUBLIC_ACCESS_PAGE_SIZE");
    if (parsePageSize(value) === undefined)
        throw new Error(
            `Invalid setting NEXT_PUBLIC_ACCESS_PAGE_SIZE: "${value}" must be a whole number of at least 1`,
        );
}

export { accessPageSize, accessSettings };
