"use client";
import { Copy, Link2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { Invitation, Role } from "@/lib/cloud-registry.types";
import {
    acceptanceLabel,
    createInvitationError,
    invitationLink,
    listInvitationsError,
    revokeInvitationError,
} from "@/lib/invitations";
import type { AccessProvider } from "./access-helper";
import RoleSelect from "./role-select";

type Props = {
    provider: AccessProvider | null;
    serviceId: string;
    disabled?: boolean;
};

/** Date and time in the user's locale */
const when = (value: string) => new Date(value).toLocaleString();

/**
 * Invitations to a service: create a link for a role, list open and
 * accepted invitations, and revoke open ones
 */
function Invitations({ provider, serviceId, disabled = false }: Props) {
    const [invitations, setInvitations] = useState<Invitation[] | null>(null);
    const [listFailure, setListFailure] = useState<string>();
    const [role, setRole] = useState<Role>("maintainer");
    const [changing, setChanging] = useState(false);
    // the link of the invitation created last; its token is only known now
    const [created, setCreated] = useState<{
        link: string;
        role: Role;
        expiresAt: string;
    }>();
    const latestRequest = useRef(0);

    const fetchInvitations = useCallback(() => {
        if (!provider) return Promise.resolve();
        const request = ++latestRequest.current;
        return provider
            .getServiceInvitations(serviceId)
            .then((val) => {
                if (request !== latestRequest.current) return;
                setInvitations(val);
                setListFailure(undefined);
            })
            .catch((err) => {
                if (request !== latestRequest.current) return;
                // an outdated list must not be acted on
                setInvitations(null);
                setListFailure(listInvitationsError(err));
            });
    }, [provider, serviceId]);

    useEffect(() => {
        fetchInvitations();
    }, [fetchInvitations]);

    // a change, then the list again, as it may have changed anyway
    const run = async (
        change: (val: AccessProvider) => Promise<void>,
        failureMessage: (err: unknown) => string,
    ) => {
        if (!provider) return;
        setChanging(true);
        try {
            await change(provider);
        } catch (err) {
            toast.error(failureMessage(err));
        }
        try {
            await fetchInvitations();
        } finally {
            setChanging(false);
        }
    };

    const create = () =>
        run(async (val) => {
            const invitation = await val.createInvitation(serviceId, { role });
            setCreated({
                link: invitationLink(window.location.origin, invitation.token),
                role: invitation.role,
                expiresAt: invitation.expires_at,
            });
        }, createInvitationError);

    const revoke = (invitation: Invitation) =>
        run(async (val) => {
            await val.revokeInvitation(serviceId, invitation.id);
            toast.success(`Revoked the ${invitation.role} invitation`);
        }, revokeInvitationError);

    const copy = (link: string) => {
        navigator.clipboard.writeText(link).then(
            () => toast.success("Copied the invitation link"),
            () => toast.error("Cannot copy the link; select and copy it."),
        );
    };

    const busy = disabled || changing;

    return (
        <section className="space-y-3" aria-label="Invitations">
            <div>
                <h3 className="font-medium">Invite by link</h3>
                <p className="text-sm text-muted-foreground">
                    Send the link to a colleague: when they log in and accept
                    it, they get the role. Each link works once and expires.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <Field className="w-40">
                    <FieldLabel htmlFor="invitation-role">Role</FieldLabel>
                    <RoleSelect
                        id="invitation-role"
                        value={role}
                        onChange={setRole}
                        disabled={busy || !invitations}
                    />
                </Field>
                <Button onClick={create} disabled={busy || !invitations}>
                    <Link2 />
                    Create link
                </Button>
            </div>

            {created && (
                <div className="space-y-1">
                    <div className="flex gap-2">
                        <Input
                            readOnly
                            value={created.link}
                            aria-label="Invitation link"
                            onFocus={(e) => e.target.select()}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copy(created.link)}
                            aria-label="Copy invitation link"
                        >
                            <Copy />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        For the {created.role} role, until{" "}
                        {when(created.expiresAt)}. The link is shown only now:
                        copy it before closing this dialog.
                    </p>
                </div>
            )}

            {listFailure && (
                <p className="text-sm text-muted-foreground">{listFailure}</p>
            )}
            {invitations && invitations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No open or accepted invitations.
                </p>
            )}
            {invitations && invitations.length > 0 && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invitation</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invitations.map((val) => (
                            <TableRow key={val.id}>
                                <TableCell className="max-w-0 w-full">
                                    <div className="grid leading-tight">
                                        <span className="flex items-center gap-2">
                                            <Badge variant="secondary">
                                                {val.role}
                                            </Badge>
                                            {val.accepted ? "Accepted" : "Open"}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {val.accepted
                                                ? `by ${acceptanceLabel(val.accepted)}, ${when(val.accepted.accepted_at)}`
                                                : `created ${when(val.created_at)}`}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                    {when(val.expires_at)}
                                </TableCell>
                                <TableCell>
                                    {!val.accepted && (
                                        <Button
                                            size={"icon-sm"}
                                            variant={"ghost"}
                                            onClick={() => revoke(val)}
                                            disabled={busy}
                                            aria-label={`Revoke ${val.role} invitation created ${when(val.created_at)}`}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </section>
    );
}

export default Invitations;
