/**
 * @description which actions the current user may take on a service,
 * from GET /me (roles via groups included); the registry enforces the
 * same rules, see `cloud_registry/config.yaml`; and whether a request
 * was refused for a missing login (401) or role (403)
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

/**
 * Check if the user may verify services
 * @param me Current user, if logged in
 * @returns True for admins
 */
function canVerifyService(me: Me | null) {
    return !!me?.admin;
}

/**
 * Check if the user may manage access to a service
 * @param me Current user, if logged in
 * @param serviceId Service identifier
 * @returns True for owners and admins
 */
function canManageAccess(me: Me | null, serviceId: string) {
    return !!me?.admin || hasRole(me, serviceId, ["owner"]);
}

/**
 * Check if a request failed with a status
 * @param err Error thrown by the provider
 * @param status HTTP status code
 * @returns True if the response had that status
 */
function hasStatus(err: unknown, status: number) {
    return err instanceof Error && "status" in err && err.status === status;
}

/**
 * Check if a request failed because the user isn't logged in
 * e.g. reads on deployments that require login for them
 * @param err Error thrown by the provider
 * @returns True for 401 responses
 */
function isUnauthorized(err: unknown) {
    return hasStatus(err, 401);
}

/**
 * Check if a request failed because the user lacks a role
 * @param err Error thrown by the provider
 * @returns True for 403 responses
 */
function isForbidden(err: unknown) {
    return hasStatus(err, 403);
}

/**
 * Check if a change conflicts with the current state
 * e.g. removing the last owner of a service
 * @param err Error thrown by the provider
 * @returns True for 409 responses
 */
function isConflict(err: unknown) {
    return hasStatus(err, 409);
}

export {
    canDeleteService,
    canEditService,
    canManageAccess,
    canVerifyService,
    hasStatus,
    isConflict,
    isForbidden,
    isUnauthorized,
};
