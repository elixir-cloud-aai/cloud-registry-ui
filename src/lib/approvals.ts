/**
 * @description which service types and services are pending: if the
 * registry moderates service types, the types that users other than admins
 * add are pending until an admin approves them, and so are the services
 * that have them; the registry lists them to admins and their creators
 * (for services: users with a role on them) in GET /approvals, which needs
 * a login, and hides them from the public reads (GET /services, GET
 * /services/{id}, GET /services/types and the verifications), see
 * cloud-registry#238
 */

import type { AuthenticatedCloudRegistryProvider } from "./authenticated-cloud-registry";
import type {
    Approvals,
    ExternalService,
    ServiceType,
} from "./cloud-registry.types";
import { hasStatus, isUnauthorized } from "./permissions";
import { compareTypes, typeKey } from "./service-types";

const noApprovals: Approvals = { service_types: [], services: [] };

/**
 * Get the pending service types and services that the user may see
 * @param provider Registry provider
 * @returns Pending types and services; none for guests, for registries
 * without approvals (before cloud-registry 0.5.0, see `hasApprovals`; or
 * 404 to the request with the token, e.g. during a rollout) and for users
 * who may not list them (403, e.g. with policies that lack
 * `list-approvals`)
 * @throws Error of other failed requests, e.g. 401 for an expired login,
 * or TypeError if the registry can't be reached
 */
async function getApprovals(provider: AuthenticatedCloudRegistryProvider) {
    if (!provider.isAuthenticated) return noApprovals;
    // in browsers, the request with the token can't tell a missing route
    // (404) from an outage: both fail without a status
    if (!(await provider.hasApprovals())) return noApprovals;
    try {
        return await provider.getApprovals();
    } catch (err) {
        if (hasStatus(err, 403) || hasStatus(err, 404)) return noApprovals;
        throw err;
    }
}

/**
 * Get the pending service types and services for a list
 * @param provider Registry provider
 * @returns Pending types and services; none for an expired login, which
 * the pages show; null if they couldn't be loaded
 */
function getApprovalsOrNull(provider: AuthenticatedCloudRegistryProvider) {
    return getApprovals(provider).catch((err) => {
        if (isUnauthorized(err)) return noApprovals;
        console.error("Failed to load the pending entries:", err);
        return null;
    });
}

/**
 * Add the pending services to the listed ones, which lack them unless the
 * registry requires login for reads
 * @param services Services from GET /services
 * @param approvals Pending types and services, if loaded
 * @returns Listed services, then the pending ones that weren't listed
 */
function withPendingServices(
    services: ExternalService[],
    approvals: Approvals | null,
) {
    const listed = new Set(services.map((val) => val.id));
    return [
        ...services,
        ...(approvals?.services ?? []).filter((val) => !listed.has(val.id)),
    ];
}

/**
 * Add the pending service types to the listed ones, which lack them unless
 * the registry requires login for reads
 * @param serviceTypes Service types from GET /services/types
 * @param approvals Pending types and services, if loaded
 * @returns All types, sorted as the registry sorts them
 */
function withPendingTypes(
    serviceTypes: ServiceType[],
    approvals: Approvals | null,
) {
    const listed = new Set(serviceTypes.map(typeKey));
    return [
        ...serviceTypes,
        ...(approvals?.service_types ?? []).filter(
            (val) => !listed.has(typeKey(val)),
        ),
    ].sort(compareTypes);
}

/**
 * Get a service, also if it is pending
 * @param provider Registry provider
 * @param serviceId Service identifier
 * @returns The service, and whether it is pending: undefined if that is
 * unknown, as the pending entries couldn't be loaded
 * @throws Error of the failed request for the service, e.g. 404 for
 * services that don't exist or that the user may not see, or 401 for an
 * expired login; or an Error if the service wasn't found and the pending
 * services couldn't be loaded, as it may be one of them
 */
async function getServiceWithApproval(
    provider: AuthenticatedCloudRegistryProvider,
    serviceId: string,
) {
    const [found, approvals] = await Promise.all([
        provider.getServiceById(serviceId).then(
            (val) => ({ service: val, error: undefined }),
            (err: unknown) => {
                // pending services are only listed in GET /approvals
                if (!hasStatus(err, 404)) throw err;
                return { service: undefined, error: err };
            },
        ),
        getApprovals(provider).catch((err) => {
            if (isUnauthorized(err)) throw err;
            console.error("Failed to load the pending services:", err);
            return null;
        }),
    ]);
    const pending = approvals?.services.find((val) => val.id === serviceId);
    const service = found.service ?? pending;
    // without the pending services, a 404 may be one of them
    if (!service && approvals === null)
        throw new Error("Could not load the pending services.");
    if (!service) throw found.error;
    return {
        service,
        pending: approvals ? !!pending : undefined,
    };
}

export {
    getApprovalsOrNull,
    getServiceWithApproval,
    withPendingServices,
    withPendingTypes,
};
