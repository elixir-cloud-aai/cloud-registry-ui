/**
 * @description which service IDs the registry accepts for renames
 * (`POST /services/{serviceId}/rename`): usable in URLs, as the API
 * specification checks them (`ServiceRename`), and in roles, as FOCA
 * checks rule values (`validate_rule_value()`), as of cloud-registry 0.6.0
 */

// FOCA's `MAX_RULE_VALUE_LENGTH`, for the service's path in roles
const maxRuleValueLength = 1024;
const reservedIds = [".", "..", "types"];
// unpaired surrogates, which the registry can't store
const unpairedSurrogate =
    /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

/**
 * Get the longest service ID that roles can hold
 * @param servicesPath Path of the services on the registry's server, e.g.
 * `/ga4gh/registry/v1/services`
 * @returns The number of characters
 */
function maxServiceIdLength(servicesPath: string) {
    return maxRuleValueLength - [...servicesPath].length - 1;
}

/**
 * Check a new service ID as the registry does
 * @param id New ID
 * @param servicesPath Path of the services on the registry's server, for
 * the length; if unknown, the registry checks it
 * @returns The message for an ID the registry rejects, else undefined
 */
function serviceIdError(id: string, servicesPath?: string) {
    if (id === "") return "Service ID is required.";
    if (reservedIds.includes(id))
        return "Service ID must not be ., .. or types.";
    if (id.includes("/")) return "Service ID must not contain slashes.";
    if (/[,\r\n]/.test(id))
        return "Service ID must not contain commas or line breaks.";
    if (unpairedSurrogate.test(id))
        return "Service ID must not contain invalid characters.";
    if (servicesPath === undefined) return undefined;
    // characters, not UTF-16 code units, as the registry counts them
    const max = maxServiceIdLength(servicesPath);
    if ([...id].length > max)
        return `Service ID must be at most ${max} characters.`;
    return undefined;
}

export { maxServiceIdLength, serviceIdError };
