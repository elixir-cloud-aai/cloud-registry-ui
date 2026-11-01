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
 * Check whether the current user may add service types that no service has,
 * e.g. on the service types page
 * @param me The user, from `GET /me`; null if logged out or not loaded
 * @param rules The registry's rules, e.g. from `useRegistrationRules()`
 * @returns Whether the registry lets the user add types
 * (`may_add_service_types`) and, for users other than admins, the limit of
 * unused types (`max_unused_service_types`) isn't 0, as the registry then
 * refuses every new type of theirs (`409`, `unused-types-limit`), also of
 * services, although `GET /me` says that they may add types
 */
function mayAddServiceTypes(
    me: Pick<Me, "admin" | "may_add_service_types"> | null | undefined,
    rules: Pick<RegistrationRules, "maxUnusedServiceTypes">,
) {
    if (!me?.may_add_service_types) return false;
    return me.admin || rules.maxUnusedServiceTypes !== 0;
}

export { compareTypes, mayAddServiceTypes, typeFromKey, typeKey, typeLabel };
