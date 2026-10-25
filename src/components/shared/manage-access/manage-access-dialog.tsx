"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type {
    GroupPermission,
    Permission,
    Role,
    ServicePermissions,
} from "@/lib/cloud-registry.types";
import {
    type AccessProvider,
    accessError,
    type GrantData,
    isForbidden,
    isGroup,
    listError,
} from "./access-helper";
import AccessList from "./access-list";
import AccessGrantForm from "./grant-form";

type Props = {
    provider: AccessProvider | null;
    serviceId: string;
    currentUserId?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChange?: () => void;
};

function ManageAccessDialog({
    provider,
    serviceId,
    currentUserId,
    open,
    onOpenChange,
    onChange,
}: Props) {
    const [permissions, setPermissions] = useState<ServicePermissions | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [changing, setChanging] = useState(false);
    const [forbidden, setForbidden] = useState(false);
    const latestRequest = useRef(0);

    const fetchPermissions = useCallback(() => {
        if (!provider) return;
        const request = ++latestRequest.current;
        provider
            .getServicePermissions(serviceId)
            .then((val) => {
                if (request === latestRequest.current) setPermissions(val);
            })
            .catch((err) => {
                if (request !== latestRequest.current) return;
                if (isForbidden(err)) {
                    setForbidden(true);
                    return;
                }
                // an outdated list must not be acted on
                setPermissions(null);
                toast.error(listError(err));
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false);
            });
    }, [provider, serviceId]);

    useEffect(() => {
        if (open) fetchPermissions();
    }, [open, fetchPermissions]);

    // e.g. after removing one's own owner role
    useEffect(() => {
        if (!forbidden) return;
        toast.error("You can no longer manage access to this service.");
        onChange?.();
        onOpenChange(false);
    }, [forbidden, onChange, onOpenChange]);

    const applyChange = async (
        promise: Promise<unknown>,
        loadingMessage: string,
        successMessage: string,
        groupGrant = false,
    ) => {
        setChanging(true);
        toast.promise(promise, {
            loading: loadingMessage,
            success: successMessage,
            error: (err) => accessError(err, groupGrant),
        });

        try {
            await promise;
            fetchPermissions();
            onChange?.();
            return true;
        } catch (err) {
            // toast.promise shows the error; the list tells if the user
            // still manages access
            if (isForbidden(err)) fetchPermissions();
            return false;
        } finally {
            setChanging(false);
        }
    };

    const grant = (kind: GrantData["kind"], principal: string, role: Role) => {
        if (!provider) return Promise.resolve(false);
        const promise =
            kind === "group"
                ? provider.grantGroupPermission(serviceId, principal, { role })
                : provider.grantServicePermission(serviceId, principal, {
                      role,
                  });
        return applyChange(
            promise,
            `Granting ${role} role to ${principal}`,
            `Granted ${role} role to ${principal}`,
            kind === "group",
        );
    };

    const handleGrant = (value: GrantData) =>
        grant(value.kind, value.principal, value.role);

    const handleRoleChange = (
        val: Permission | GroupPermission,
        role: Role,
    ) => {
        if (role === val.role) return;
        if (isGroup(val)) grant("group", val.group, role);
        else grant("user", val.user_id, role);
    };

    const handleRevoke = (val: Permission | GroupPermission) => {
        if (!provider) return;
        const principal = isGroup(val) ? val.group : val.user_id;
        const promise = isGroup(val)
            ? provider.revokeGroupPermission(serviceId, val.group)
            : provider.revokeServicePermission(serviceId, val.user_id);
        applyChange(
            promise,
            `Removing roles of ${principal}`,
            `Removed roles of ${principal}`,
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                        Manage access
                    </DialogTitle>
                    <DialogDescription>
                        Owners can edit and delete {serviceId} and manage access
                        to it; maintainers can edit it.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                )}
                {!loading && !permissions && (
                    <p className="text-sm text-muted-foreground">
                        Cannot load the access list.
                    </p>
                )}
                {permissions && (
                    <AccessList
                        permissions={permissions}
                        currentUserId={currentUserId}
                        disabled={changing}
                        onRoleChange={handleRoleChange}
                        onRevoke={handleRevoke}
                    />
                )}

                <Separator />

                <AccessGrantForm
                    onGrant={handleGrant}
                    disabled={changing || !permissions}
                />
            </DialogContent>
        </Dialog>
    );
}

export default ManageAccessDialog;
