/**
 * @description labels and keys of service types, for pages and shared
 * components
 */

import type { ServiceType } from "./cloud-registry.types";

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

export { typeFromKey, typeKey, typeLabel };
