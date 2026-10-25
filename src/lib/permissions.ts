/**
 * @description which actions the current user may take on a service,
 * from GET /me (roles via groups included); the registry enforces the
 * same rules, see `cloud_registry/config.yaml`
 */

import type { Me } from "./cloud-registry.types";

function hasRole(me: Me | null, serviceId: string, roles: string[]) {
    return !!me?.services.some(
        (val) => val.service_id === serviceId && roles.includes(val.role),
    );
}

/**
 * Check if the user may edit a service
 * @param me Current user, if logged in
 * @param serviceId Service identifier
 * @returns True for owners, maintainers and admins
 */
function canEditService(me: Me | null, serviceId: string) {
    return !!me?.admin || hasRole(me, serviceId, ["owner", "maintainer"]);
}

/**
 * Check if the user may delete a service
 * @param me Current user, if logged in
 * @param serviceId Service identifier
 * @returns True for owners and admins
 */
function canDeleteService(me: Me | null, serviceId: string) {
    return !!me?.admin || hasRole(me, serviceId, ["owner"]);
}

export { canDeleteService, canEditService };
