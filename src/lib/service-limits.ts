/**
 * @description the registry's limit of services per user (cloud-registry
 * #124; `409` with code `services-limit`), as its service info publishes it
 * (`registration_rules.max_services_per_user`)
 */
import type { AuthenticatedCloudRegistryProvider } from "./authenticated-cloud-registry";

/**
 * Get the limit of services per user from the registry's service info
 * @param info Service info, as `GET /service-info` returns it
 * @returns The limit; undefined without one, or for registries that don't
 * publish it
 */
function maxServicesPerUser(info: unknown) {
    const rules =
        info !== null &&
        typeof info === "object" &&
        "registration_rules" in info
            ? info.registration_rules
            : undefined;
    const limit =
        rules !== null &&
        typeof rules === "object" &&
        "max_services_per_user" in rules
            ? rules.max_services_per_user
            : undefined;
    return typeof limit === "number" && Number.isInteger(limit) && limit >= 0
        ? limit
        : undefined;
}

/**
 * Get the registry's limit of services per user
 * @param provider The registry's client, if any
 * @returns The limit; undefined without one, or if it can't be read
 */
async function servicesLimit(
    provider: Pick<AuthenticatedCloudRegistryProvider, "getServiceInfo"> | null,
) {
    try {
        return maxServicesPerUser(await provider?.getServiceInfo());
    } catch {
        return undefined;
    }
}

/**
 * Get the message for a registration over the limit
 * @param limit The limit; `0` if only admins register services
 * @param adminAvailable Whether the user may switch to admin mode, in
 * which registrations don't count
 * @returns The message, with what to do
 */
function servicesLimitMessage(limit: number, adminAvailable = false) {
    const message =
        limit === 0
            ? "Only admins can register services in this registry. Please ask an admin."
            : `You have registered as many services as this registry allows (${limit}). Delete services you no longer need, or ask an admin.`;
    return adminAvailable
        ? `${message} As an admin, you can also register it in admin mode.`
        : message;
}

export { maxServicesPerUser, servicesLimit, servicesLimitMessage };
