import {
    type AuthenticatedCloudRegistryProvider,
    dotSegment,
} from "@/lib/authenticated-cloud-registry";
import type {
    GroupPermission,
    Permission,
    Role,
} from "@/lib/cloud-registry.types";
import { errorMessage, isLastOwner, mutationError } from "@/lib/errors";
import { isForbidden, isUnauthorized } from "@/lib/permissions";
import { z } from "@/lib/zod";

export type AccessProvider = Pick<
    AuthenticatedCloudRegistryProvider,
    | "getServicePermissions"
    | "grantServicePermission"
    | "revokeServicePermission"
    | "grantGroupPermission"
    | "revokeGroupPermission"
    | "createInvitation"
    | "getServiceInvitations"
    | "revokeInvitation"
>;

const roles = ["owner", "maintainer"] as const satisfies readonly Role[];

export const roleOptions = roles.map((value) => ({
    label: value.charAt(0).toUpperCase() + value.slice(1),
    value,
}));

export const grantSchema = z
    .object({
        kind: z.enum(["user", "group"]),
        principal: z.string().trim(),
        role: z.enum(roles),
    })
    .superRefine((val, ctx) => {
        if (!val.principal)
            ctx.addIssue({
                code: "custom",
                path: ["principal"],
                message:
                    val.kind === "user"
                        ? "User ID is required."
                        : "Group is required.",
            });
        // a leading slash would make the path that of another user or group
        else if (val.principal.startsWith("/"))
            ctx.addIssue({
                code: "custom",
                path: ["principal"],
                message:
                    val.kind === "user"
                        ? "User ID can't start with '/'."
                        : "Group can't start with '/'.",
            });
        // as the registry: clients resolve dot segments in URLs
        else if (dotSegment.test(val.principal))
            ctx.addIssue({
                code: "custom",
                path: ["principal"],
                message:
                    val.kind === "user"
                        ? "User ID can't have the parts '.' or '..'."
                        : "Group can't have the parts '.' or '..'.",
            });
    });

export type GrantData = z.infer<typeof grantSchema>;

export const defaultGrant: GrantData = {
    kind: "user",
    principal: "",
    role: "maintainer",
};

export function isGroup(
    val: Permission | GroupPermission,
): val is GroupPermission {
    return "group" in val;
}

export { isForbidden, isUnauthorized };

/**
 * Get the display name of a user with a role
 * @param val Role of the user
 * @returns The name, if the registry knows it (once the user has used it)
 */
export function userName(val: Permission) {
    return val.name?.trim() || undefined;
}

/**
 * Filter users and groups with a role
 * @param permissions Roles on the service
 * @param query Text to find in names, user IDs, groups and roles, in any
 * case; all match an empty one
 * @returns The matching roles, in order
 */
export function filterHolders(
    permissions: (Permission | GroupPermission)[],
    query: string,
) {
    const value = query.trim().toLowerCase();
    if (!value) return permissions;
    return permissions.filter((val) =>
        (isGroup(val)
            ? [val.group, val.role]
            : [val.user_id, val.name ?? "", val.role]
        ).some((field) => field.toLowerCase().includes(value)),
    );
}

/** Get the message for a failed listing of access to a service */
export function listError(err: unknown) {
    return errorMessage(
        err,
        "Cannot fetch the access list. Please try again later.",
    );
}

/** Get the message for a failed change of access to a service */
export function accessError(err: unknown, groupGrant = false) {
    // the registry keeps at least one owner (user or group)
    if (isLastOwner(err))
        return "Add another owner first, or delete the service.";
    if (groupGrant && isForbidden(err))
        return "You can grant roles only to groups you are a member of.";
    return mutationError(err, "Cannot change access currently.");
}
