import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import type {
    GroupPermission,
    Permission,
    Role,
} from "@/lib/cloud-registry.types";
import { errorMessage, mutationError } from "@/lib/errors";
import { isConflict, isForbidden, isUnauthorized } from "@/lib/permissions";
import { z } from "@/lib/zod";

export type AccessProvider = Pick<
    AuthenticatedCloudRegistryProvider,
    | "getServicePermissions"
    | "grantServicePermission"
    | "revokeServicePermission"
    | "grantGroupPermission"
    | "revokeGroupPermission"
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
        // a leading slash would make the path that of another group
        else if (val.kind === "group" && val.principal.startsWith("/"))
            ctx.addIssue({
                code: "custom",
                path: ["principal"],
                message: "Group can't start with '/'.",
            });
        // dots only: `.` and `..` would be dot segments of the API path
        else if (/^\.+$/.test(val.principal))
            ctx.addIssue({
                code: "custom",
                path: ["principal"],
                message:
                    val.kind === "user"
                        ? "User ID can't consist of dots only."
                        : "Group can't consist of dots only.",
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
    if (isConflict(err))
        return "Add another owner first, or delete the service.";
    if (groupGrant && isForbidden(err))
        return "You can grant roles only to groups you are a member of.";
    return mutationError(err, "Cannot change access currently.");
}
