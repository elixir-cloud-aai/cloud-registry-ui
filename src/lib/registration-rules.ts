/**
 * @description the registry's rules for registrations, as its service info
 * publishes them (`registrationRules` of `GET /service-info`; before
 * cloud-registry 1.0.0rc2, `registration_rules`, which isn't read): the one
 * place that reads them. Use
 * `useRegistrationRules()` in components, `readRegistrationRules()`
 * elsewhere, and `serviceSchema()` (`service-schema.ts`) to check
 * registrations as the registry does. Each rule falls back to the
 * registry's default (`defaultRegistrationRules`) if it is missing or
 * invalid. Registries older than cloud-registry 1.0.0rc2 publish no rules
 * under this name: they count as unknown, like a failed read, and forms then leave the
 * checks of the rules to the registry (`unknownRegistrationRules`).
 */

import { z } from "@/lib/zod";
import { isAborted } from "./abort";
import type {
    AuthenticatedCloudRegistryProvider,
    ReadOptions,
} from "./authenticated-cloud-registry";

/** Who may add service types (`custom.access_control.service_types`) */
type ServiceTypesMode = "open" | "controlled" | "moderated";

/** Whether and how often the registry syncs services with their service info */
type ServiceInfoSyncRule = {
    enabled: boolean;
    /** Time between the syncs of a service, in hours */
    intervalHours: number;
};

/** The registry's rules for registrations */
type RegistrationRules = {
    /** Allowed environments of services, in the registry's order; empty
     * if any value is allowed */
    environments: readonly string[];
    /** Allowed schemes of service URLs, lowercase: `https` and `http` */
    urlSchemes: readonly string[];
    /** Who may add service types; undefined if unknown */
    serviceTypes?: ServiceTypesMode;
    /** How many unused types users other than admins may have added;
     * undefined without a limit, or if unknown */
    maxUnusedServiceTypes?: number;
    /** How many services users other than admins may have registered;
     * undefined without a limit, or if unknown */
    maxServicesPerUser?: number;
    /** Whether and how often the registry syncs services with their service
     * info; undefined if unknown: such registries (older than
     * cloud-registry 1.0.0rc2) have no import of service info either */
    serviceInfoSync?: ServiceInfoSyncRule;
};

// the schemes the registry can allow for service URLs
const knownUrlSchemes = ["http", "https"];
// as long as the API allows (`maxLength` of `environment`)
const maxEnvironmentLength = 256;
// how long to wait for the service info, so that a stalled registry
// doesn't hold up the forms; the registry checks the entries anyway
const serviceInfoTimeout = 10_000;

/** The registry's defaults, for rules it doesn't publish */
const defaultRegistrationRules: Readonly<RegistrationRules> = Object.freeze({
    environments: Object.freeze(["prod", "test", "dev", "staging"]),
    urlSchemes: Object.freeze(["https"]),
});

/** Rules that leave the checks to the registry, if its rules are unknown:
 * any environment, and any scheme that the registry can allow */
const unknownRegistrationRules: Readonly<RegistrationRules> = Object.freeze({
    environments: Object.freeze([]),
    urlSchemes: Object.freeze([...knownUrlSchemes]),
});

const limit = z.int().nonnegative().optional().catch(undefined);
const rulesSchema = z.object({
    environments: z
        .array(z.string())
        // no empty value, nor the select's value for none (`,`)
        .transform((values) => [
            ...new Set(values.filter((value) => value && value !== ",")),
        ])
        .catch(() => [...defaultRegistrationRules.environments]),
    urlSchemes: z
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
    serviceTypes: z
        .enum(["open", "controlled", "moderated"])
        .optional()
        .catch(undefined),
    maxUnusedServiceTypes: limit,
    maxServicesPerUser: limit,
    serviceInfoSync: z
        .object({ enabled: z.boolean(), intervalHours: z.number().positive() })
        .optional()
        .catch(undefined),
});

/**
 * Get the registration rules from the registry's service info
 * @param info Service info, as `GET /service-info` returns it
 * @returns The rules; the registry's defaults for those it doesn't publish
 * or that are invalid; undefined if it publishes none (registries older
 * than cloud-registry 1.0.0rc2)
 */
function registrationRules(info: unknown): RegistrationRules | undefined {
    if (
        info === null ||
        typeof info !== "object" ||
        !("registrationRules" in info) ||
        info.registrationRules === null ||
        typeof info.registrationRules !== "object" ||
        Array.isArray(info.registrationRules)
    )
        return undefined;
    return rulesSchema.parse(info.registrationRules);
}

/**
 * Read the registration rules from the registry
 * @param provider The registry's client, if any
 * @param options `timeout`: how long to wait for the service info, in
 * milliseconds; `signal`: aborts the read
 * @returns The rules; undefined without a client, if the service info
 * can't be read in time (logged), if the read is aborted (not logged), or
 * if it has no rules
 */
async function readRegistrationRules(
    provider: Pick<AuthenticatedCloudRegistryProvider, "getServiceInfo"> | null,
    {
        timeout = serviceInfoTimeout,
        signal,
    }: { timeout?: number } & ReadOptions = {},
) {
    if (!provider) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const info = await Promise.race([
            provider.getServiceInfo({ signal }),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("timed out")),
                    timeout,
                );
            }),
        ]);
        return registrationRules(info);
    } catch (err) {
        if (!isAborted(err))
            console.error("Failed to load the registration rules:", err);
        return undefined;
    } finally {
        clearTimeout(timer);
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
    type ServiceInfoSyncRule,
    type ServiceTypesMode,
    unknownRegistrationRules,
};
