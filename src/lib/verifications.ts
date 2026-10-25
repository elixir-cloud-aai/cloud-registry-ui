/**
 * @description which services are verified: a verification from
 * GET /verifications or GET /services/{id}/verification only counts while
 * the service still has the verified URL (as written) and API type
 * (`type.group`, `type.artifact`, trimmed and case-insensitive), as the
 * registry checks them, see `PUT /services/{id}/verification`; the registry
 * uses Python's `strip().casefold()`: trimming here uses the same whitespace
 * (JavaScript's `\s` without U+FEFF, plus U+001C-U+001F and U+0085), but a
 * few characters (e.g. `ß`) still compare differently
 */

import type {
    ExternalService,
    ServiceVerification,
    Verification,
} from "./cloud-registry.types";

function isSpace(char: string) {
    return (
        (/\s/.test(char) && char !== "\uFEFF") ||
        "\x1c\x1d\x1e\x1f\x85".includes(char)
    );
}

function strip(text: string) {
    let start = 0;
    let end = text.length;
    while (start < end && isSpace(text[start])) start++;
    while (end > start && isSpace(text[end - 1])) end--;
    return text.slice(start, end);
}

function sameText(a: string, b: string) {
    return strip(a).toLowerCase() === strip(b).toLowerCase();
}

/**
 * Check if a verification still matches a service
 * @param service URL and API type of the service, e.g. form values
 * @param verification Verification of the service
 * @returns True if the URL and API type are those that were verified
 */
function matchesVerification(
    service: Pick<ExternalService, "url" | "type">,
    verification: Verification,
) {
    return (
        service.url === verification.url &&
        sameText(service.type.group, verification.type.group) &&
        sameText(service.type.artifact, verification.type.artifact)
    );
}

/**
 * Get the verifications that still match their services
 * @param services Services as registered
 * @param verifications Verifications from GET /verifications
 * @returns Verifications by service identifier
 */
function verifiedServices(
    services: ExternalService[],
    verifications: ServiceVerification[],
) {
    const servicesById = new Map(services.map((val) => [val.id, val]));
    return new Map(
        verifications
            .filter((val) => {
                const service = servicesById.get(val.service_id);
                return !!service && matchesVerification(service, val);
            })
            .map((val) => [val.service_id, val]),
    );
}

export { matchesVerification, verifiedServices };
