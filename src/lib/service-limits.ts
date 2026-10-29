/**
 * @description the registry's limit of services per user (cloud-registry
 * 1.0.0; `409` with code `services-limit`), as its service info publishes
 * it (`registration_rules.max_services_per_user`)
 */
import { isServicesLimit } from "./errors";

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
    return Number.isInteger(limit) && (limit as number) >= 0
        ? (limit as number)
        : undefined;
}

/**
 * Get the message for a registration over the limit
 * @param limit The limit, if known; `0` if only admins register services
 * @returns The message, with what to do
 */
function servicesLimitMessage(limit: number | undefined) {
    if (limit === 0)
        return "Only admins can register services in this registry. Please ask an admin.";
    const count = limit === undefined ? "" : ` (${limit})`;
    return `You have registered as many services as this registry allows${count}. Delete services you no longer need, or ask an admin.`;
}

export { isServicesLimit, maxServicesPerUser, servicesLimitMessage };
