/**
 * @description admin mode (cloud-registry#240): admins act as admins only in
 * requests that ask for the role `admin` (header `X-Request-Roles`), so that
 * admin rights are a deliberate choice. The choice is kept in a cookie for
 * the browser session; logins and logouts end it, so that admins start in
 * user mode.
 */
import type { Me } from "./cloud-registry.types";

const adminModeCookie = "admin_mode";
// the cookie's value in admin mode
const adminModeOn = "1";

/**
 * Check whether admin mode is on
 * @param cookie Value of the admin mode cookie, if set
 * @returns True if the cookie says so
 */
function isAdminMode(cookie: unknown) {
    return cookie === adminModeOn;
}

/**
 * Get the opt-in roles of requests
 * @param adminMode Whether admin mode is on
 * @returns `["admin"]` in admin mode, else none
 */
function requestRoles(adminMode: boolean) {
    return adminMode ? ["admin"] : [];
}

/**
 * Get the state of the switch between user and admin mode
 * @param me Current user, as of a request in the current mode, if known
 * @param adminMode Whether admin mode is on
 * @returns `"admin"` in admin mode with admin rights; `"unavailable"` in
 * admin mode without them (e.g. if requests fail, or the registry ignores
 * the header), so that users can always switch back; `"user"` for users who
 * may switch to admin mode; undefined (no switch) for others, and for
 * admins of registries without admin mode (admins without asking for the
 * role, or without `admin_available`)
 */
function adminModeState(me: Me | null, adminMode: boolean) {
    if (adminMode) return me?.admin ? "admin" : "unavailable";
    if (me?.admin_available && !me.admin) return "user";
    return undefined;
}

export {
    adminModeCookie,
    adminModeOn,
    adminModeState,
    isAdminMode,
    requestRoles,
};
