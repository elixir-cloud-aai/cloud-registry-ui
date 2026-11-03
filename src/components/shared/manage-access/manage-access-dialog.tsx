"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accessPageSize, invitationLabelRequired } from "@/lib/access-settings";
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
    isUnauthorized,
    listError,
} from "./access-helper";
import AccessList from "./access-list";
import AccessGrantForm from "./grant-form";
import Invitations from "./invitations";

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
    const [inviting, setInviting] = useState(false);
    const [invitationCount, setInvitationCount] = useState<number>();
    // why the dialog must close, e.g. after removing one's own owner role
    const [closeReason, setCloseReason] = useState<string | null>(null);
    const latestRequest = useRef(0);
    const pageSize = accessPageSize();

    const fetchPermissions = useCallback(() => {
        if (!provider) return Promise.resolve();
        const request = ++latestRequest.current;
        return provider
            .getServicePermissions(serviceId)
            .then((val) => {
                if (request === latestRequest.current) setPermissions(val);
            })
            .catch((err) => {
                if (request !== latestRequest.current) return;
                if (isUnauthorized(err)) {
                    setCloseReason(
                        "Your session expired. Please log in again.",
                    );
                    return;
                }
                if (isForbidden(err)) {
                    setCloseReason(
                        "You can no longer manage access to this service.",
                    );
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

    useEffect(() => {
        if (!closeReason) return;
        toast.error(closeReason);
        // refreshes the user: hides lost controls, or clears an expired login
        onChange?.();
        onOpenChange(false);
    }, [closeReason, onChange, onOpenChange]);

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

        // toast.promise shows the error; either way, the list is fetched
        // again before the next change, as it may have changed anyway
        const changed = await promise.then(
            () => true,
            () => false,
        );
        await fetchPermissions();
        if (changed) onChange?.();
        setChanging(false);
        return changed;
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
        <Dialog
            open={open}
            onOpenChange={(val) => {
                // a change in progress refreshes only this dialog
                if (!changing && !inviting) onOpenChange(val);
            }}
        >
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                        Manage Access
                    </DialogTitle>
                    <DialogDescription>
                        Owners can edit and delete {serviceId} and manage access
                        to it; maintainers can edit it.
                    </DialogDescription>
                </DialogHeader>

                {/* table rows low enough for a laptop's window */}
                <Tabs
                    defaultValue="access"
                    // an invitation may have been accepted, by now or in the
                    // meantime: the other tab then no longer lists it
                    onValueChange={(tab) => {
                        if (tab === "access" && !changing) fetchPermissions();
                    }}
                    className="min-w-0 [&_td]:py-1.5 [&_th]:h-9"
                >
                    <TabsList>
                        <TabsTrigger value="access">Current Access</TabsTrigger>
                        <TabsTrigger value="invitations">
                            Invitations
                            {invitationCount !== undefined && (
                                <Badge variant="secondary">
                                    {invitationCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* both stay mounted: the links of new invitations are
                        known only to the component, and the second tab
                        shows the number of invitations from the start */}
                    <TabsContent
                        value="access"
                        forceMount
                        className="space-y-4 data-[state=inactive]:hidden"
                    >
                        {loading && (
                            <p className="text-sm text-muted-foreground">
                                Loading...
                            </p>
                        )}
                        {!loading && !permissions && (
                            <p className="text-sm text-muted-foreground">
                                Cannot load the access list.
                            </p>
                        )}
                        {permissions && (
                            <AccessList
                                permissions={permissions}
                                pageSize={pageSize}
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
                    </TabsContent>

                    <TabsContent
                        value="invitations"
                        forceMount
                        className="data-[state=inactive]:hidden"
                    >
                        <Invitations
                            provider={provider}
                            serviceId={serviceId}
                            pageSize={pageSize}
                            labelRequired={invitationLabelRequired()}
                            disabled={changing}
                            onChanging={setInviting}
                            onCountChange={setInvitationCount}
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

export default ManageAccessDialog;
