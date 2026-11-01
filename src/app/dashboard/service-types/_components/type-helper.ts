import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import type { Me } from "@/lib/cloud-registry.types";
import type { RegistrationRules } from "@/lib/registration-rules";
import { defaultTypeGroup } from "@/lib/service-schema";
import { mayAddServiceTypes } from "@/lib/service-types";

export const defaultType: ServiceType = {
    group: defaultTypeGroup,
    artifact: "",
    version: "",
};

/**
 * Get the description of the dialog that adds a service type
 * @param pending Whether the user's new types are pending
 * @param limit How many types that no service has the user may have added;
 * undefined without a limit (e.g. for admins)
 * @returns What adding a type does, and the limit
 */
export function addTypeDescription(pending: boolean, limit?: number) {
    const description = pending
        ? "Services can then be registered with this type. New types are pending until an admin approves them: until then, only admins and you see the type, and the services that have it are pending too."
        : "Services can then be registered with this type.";
    if (limit === undefined) return description;
    const types = limit === 1 ? "1 service type" : `${limit} service types`;
    return `${description} You may have added up to ${types} that no service has: they count until services have them or an admin removes them.`;
}

/**
 * Get the note for users whom `GET /me` lets add service types, but who may
 * have added no unused types (`max_unused_service_types` is 0), so that the
 * registry refuses every new type of theirs
 * @param me The user, from `GET /me`
 * @param rules The registry's rules
 * @returns The note, if the page doesn't offer adding types for this reason
 */
export function typeLimitNote(
    me: Pick<Me, "admin" | "admin_available" | "may_add_service_types"> | null,
    rules: Pick<RegistrationRules, "maxUnusedServiceTypes">,
) {
    if (!me?.may_add_service_types || mayAddServiceTypes(me, rules))
        return undefined;
    return me.admin_available
        ? "Only admins can add service types in this registry. Switch to admin mode to add one."
        : "Only admins can add service types in this registry. Please ask an admin to add the type you need.";
}
