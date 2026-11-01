/**
 * @description labels and keys of service types, for pages and shared
 * components
 */

import type { Me, ServiceType } from "./cloud-registry.types";
import type { RegistrationRules } from "./registration-rules";

/**
 * Get the label of a service type
 * @param serviceType Service type
 * @returns Group, artifact and version, e.g. "org.ga4gh · tes · 1.1.0"
 */
function typeLabel({ group, artifact, version }: ServiceType) {
    return `${group} · ${artifact} · ${version}`;
}

/**
 * Get a key of a service type, e.g. for sets and React keys
 * @param serviceType Service type
 * @returns The same key for the same group, artifact and version
 */
function typeKey({ group, artifact, version }: ServiceType) {
    return JSON.stringify([group, artifact, version]);
}

/**
 * Get the service type of a key
 * @param key Key from `typeKey()`
 * @returns The service type
 */
function typeFromKey(key: string): ServiceType {
    const [group, artifact, version] = JSON.parse(key) as string[];
    return { group, artifact, version };
}

/**
 * Compare service types as the registry sorts them
 * @param a Service type
 * @param b Service type
 * @returns Negative if `a` comes first, positive if `b` does, else 0
 */
function compareTypes(a: ServiceType, b: ServiceType) {
    for (const key of ["group", "artifact", "version"] as const)
        if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
    return 0;
}

/**
 * Check whether users other than admins may add no service types at all
 * @param rules The registry's rules
 * @returns Whether their limit of unused types (`max_unused_service_types`)
 * is 0: the registry then refuses every new type of theirs (`409`,
 * `unused-types-limit`), also of services, in every mode
 */
function noUnusedTypes(
    rules: Pick<RegistrationRules, "maxUnusedServiceTypes">,
) {
    return rules.maxUnusedServiceTypes === 0;
}

/**
 * Get the current user's limit of unused service types
 * @param me The user, from `GET /me`; null if logged out or not loaded
 * @param rules The registry's rules, e.g. from `useRegistrationRules()`
 * @returns How many types that no service has the user may have added;
 * undefined without a limit, for admins, or if unknown
 */
function unusedTypesLimit(
    me: Pick<Me, "admin"> | null | undefined,
    rules: Pick<RegistrationRules, "maxUnusedServiceTypes">,
) {
    return me?.admin ? undefined : rules.maxUnusedServiceTypes;
}

/**
 * Check whether the current user may add service types that no service has,
 * e.g. on the service types page
 * @param me The user, from `GET /me`; null if logged out or not loaded
 * @param rules The registry's rules, e.g. from `useRegistrationRules()`
 * @returns Whether the registry lets the user add types
 * (`may_add_service_types`) and, for users other than admins, the limit of
 * unused types isn't 0 (`noUnusedTypes()`), although `GET /me` then still
 * says that they may add types
 */
function mayAddServiceTypes(
    me: Pick<Me, "admin" | "may_add_service_types"> | null | undefined,
    rules: Pick<RegistrationRules, "maxUnusedServiceTypes">,
) {
    if (!me?.may_add_service_types) return false;
    return me.admin || !noUnusedTypes(rules);
}

export {
    compareTypes,
    mayAddServiceTypes,
    noUnusedTypes,
    typeFromKey,
    typeKey,
    typeLabel,
    unusedTypesLimit,
};
