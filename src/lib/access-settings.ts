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
 * Parse whether invitations need a label
 * @param value Text of the setting; blank counts as not set
 * @returns The value, the default if not set, or undefined if invalid
 */
function parseLabelRequired(value = "") {
    const text = value.trim();
    if (!text || text === "true") return true;
    return text === "false" ? false : undefined;
}

/**
 * Tell whether the form for invitations requires a label; the registry
 * doesn't, so this is up to the deployment
 * @returns The setting `NEXT_PUBLIC_INVITATION_LABEL_REQUIRED`, or the
 * default if it isn't set; invalid values stop the server first
 */
function invitationLabelRequired() {
    return (
        parseLabelRequired(
            publicSetting("NEXT_PUBLIC_INVITATION_LABEL_REQUIRED"),
        ) ?? true
    );
}

/**
 * Check the settings of the dialog; invalid values stop the server
 * @throws Error naming the first invalid setting
 */
function accessSettings() {
    const pageSize = publicSetting("NEXT_PUBLIC_ACCESS_PAGE_SIZE");
    if (parsePageSize(pageSize) === undefined)
        throw new Error(
            `Invalid setting NEXT_PUBLIC_ACCESS_PAGE_SIZE: "${pageSize}" must be a whole number of at least 1`,
        );
    const labelRequired = publicSetting(
        "NEXT_PUBLIC_INVITATION_LABEL_REQUIRED",
    );
    if (parseLabelRequired(labelRequired) === undefined)
        throw new Error(
            `Invalid setting NEXT_PUBLIC_INVITATION_LABEL_REQUIRED: "${labelRequired}" must be true or false`,
        );
}

export { accessPageSize, accessSettings, invitationLabelRequired };
