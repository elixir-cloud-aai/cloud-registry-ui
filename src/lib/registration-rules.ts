/**
 * @description the registry's rules for registrations, as its service info
 * publishes them (`registration_rules` of `GET /service-info`, since
 * cloud-registry 0.6.0): the one place that reads them. Use
 * `useRegistrationRules()` in components, `readRegistrationRules()`
 * elsewhere, and `serviceSchema()` (`service-schema.ts`) to check
 * registrations as the registry does. Each rule falls back to the
 * registry's default (`defaultRegistrationRules`) if it is missing or
 * invalid, e.g. for registries that don't publish it.
 */

import { z } from "@/lib/zod";
import type { AuthenticatedCloudRegistryProvider } from "./authenticated-cloud-registry";

/** Who may add service types (`custom.access_control.service_types`) */
type ServiceTypesMode = "open" | "controlled" | "moderated";

/** The registry's rules for registrations */
type RegistrationRules = {
    /** Allowed environments of services, in the registry's order; empty
     * if any value is allowed */
    environments: string[];
    /** Allowed schemes of service URLs, lowercase: `https` and `http` */
    urlSchemes: string[];
    /** Who may add service types; undefined if unknown */
    serviceTypes?: ServiceTypesMode;
    /** How many unused types users other than admins may have added;
     * undefined without a limit, or if unknown */
    maxUnusedServiceTypes?: number;
    /** How many services users other than admins may have registered;
     * undefined without a limit, or if unknown */
    maxServicesPerUser?: number;
};

// the schemes the registry can allow for service URLs
const knownUrlSchemes = ["http", "https"];
// as long as the API allows (`maxLength` of `environment`)
const maxEnvironmentLength = 256;

/** The registry's defaults, for rules it doesn't publish */
const defaultRegistrationRules: Readonly<RegistrationRules> = Object.freeze({
    environments: ["prod", "test", "dev", "staging"],
    urlSchemes: ["https"],
});

const limit = z.int().nonnegative().optional().catch(undefined);
const rulesSchema = z.object({
    environments: z
        .array(z.string())
        .transform((values) => [...new Set(values)])
        .catch(() => [...defaultRegistrationRules.environments]),
    url_schemes: z
        .array(z.string())
        .transform((values) => [
            ...new Set(
                values
                    .map((value) => value.toLowerCase())
                    .filter((value) => knownUrlSchemes.includes(value)),
            ),
        ])
        .refine((values) => values.length > 0)
        .catch(() => [...defaultRegistrationRules.urlSchemes]),
    service_types: z
        .enum(["open", "controlled", "moderated"])
        .optional()
        .catch(undefined),
    max_unused_service_types: limit,
    max_services_per_user: limit,
});

/**
 * Get the registration rules from the registry's service info
 * @param info Service info, as `GET /service-info` returns it
 * @returns The rules; the registry's defaults for those it doesn't publish
 * or that are invalid
 */
function registrationRules(info: unknown): RegistrationRules {
    const published =
        info !== null &&
        typeof info === "object" &&
        "registration_rules" in info &&
        info.registration_rules !== null &&
        typeof info.registration_rules === "object"
            ? info.registration_rules
            : {};
    const rules = rulesSchema.parse(published);
    return {
        environments: rules.environments,
        urlSchemes: rules.url_schemes,
        serviceTypes: rules.service_types,
        maxUnusedServiceTypes: rules.max_unused_service_types,
        maxServicesPerUser: rules.max_services_per_user,
    };
}

/**
 * Read the registration rules from the registry
 * @param provider The registry's client, if any
 * @returns The rules; undefined without a client, or if the service info
 * can't be read
 */
async function readRegistrationRules(
    provider: Pick<AuthenticatedCloudRegistryProvider, "getServiceInfo"> | null,
) {
    if (!provider) return undefined;
    try {
        return registrationRules(await provider.getServiceInfo());
    } catch {
        return undefined;
    }
}

/**
 * Check whether the registry accepts an environment
 * @param environments Allowed environments; empty for any
 * @param value Environment, if any
 * @returns Whether it is empty or allowed
 */
function isAllowedEnvironment(environments: readonly string[], value?: string) {
    return !value || !environments.length || environments.includes(value);
}

/**
 * Get the message for an environment that the registry doesn't allow
 * @param environments Allowed environments, not empty
 * @returns The message, as the registry words it
 */
function environmentMessage(environments: readonly string[]) {
    return `Environment must be one of: ${environments.map((value) => `'${value}'`).join(", ")}.`;
}

/**
 * Get the position of an environment in the allowed ones, for sorting
 * @param environments Allowed environments
 * @param value Environment
 * @returns Its index, or the number of allowed environments if not one
 */
function environmentRank(environments: readonly string[], value: string) {
    const index = environments.indexOf(value);
    return index === -1 ? environments.length : index;
}

export {
    defaultRegistrationRules,
    environmentMessage,
    environmentRank,
    isAllowedEnvironment,
    maxEnvironmentLength,
    type RegistrationRules,
    readRegistrationRules,
    registrationRules,
    type ServiceTypesMode,
};
