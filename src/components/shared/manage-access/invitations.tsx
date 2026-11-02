"use client";
import { Copy, Link2, RefreshCw, Trash2 } from "lucide-react";
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
import { Toggle } from "@/components/ui/toggle";
import type { Invitation, Role } from "@/lib/cloud-registry.types";
import {
    acceptanceLabel,
    type CreatedLink,
    createInvitationError,
    invitationLink,
    listInvitationsError,
    liveLinks,
    renewRevokeError,
    revokeInvitationError,
    splitInvitations,
} from "@/lib/invitations";
import type { AccessProvider } from "./access-helper";
import RoleSelect from "./role-select";

type Props = {
    provider: AccessProvider | null;
    serviceId: string;
    disabled?: boolean;
    /** Called when a change starts and ends, e.g. to keep a dialog open */
    onChanging?: (changing: boolean) => void;
};

/** Date and time in the user's locale */
const when = (value: string) => new Date(value).toLocaleString();

/**
 * Invitations to a service: create a link for a role, list open and
 * (on request) accepted invitations, give open ones a new link, and revoke
 * them. The links created while the component is shown stay available;
 * the registry stores only hashes of the tokens, so no others are known
 */
function Invitations({
    provider,
    serviceId,
    disabled = false,
    onChanging,
}: Props) {
    const [invitations, setInvitations] = useState<Invitation[] | null>(null);
    const [listFailure, setListFailure] = useState<string>();
    const [role, setRole] = useState<Role>("maintainer");
    const [changing, setChanging] = useState(false);
    const [showAccepted, setShowAccepted] = useState(false);
    // the links created here, oldest first; their tokens are only known now
    const [created, setCreated] = useState<CreatedLink[]>([]);
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
        // new links are shown only while the dialog is open
        onChanging?.(true);
        try {
            await change(provider);
        } catch (err) {
            toast.error(failureMessage(err));
        }
        // `fetchInvitations` reports its own failures
        await fetchInvitations();
        setChanging(false);
        onChanging?.(false);
    };

    // a link stops working with its invitation, also if the list can't be
    // loaded again to tell
    const dropLink = (id: string) =>
        setCreated((links) => links.filter((val) => val.id !== id));

    const createLink = async (val: AccessProvider, linkRole: Role) => {
        const invitation = await val.createInvitation(serviceId, {
            role: linkRole,
        });
        setCreated((links) => [
            ...links,
            {
                id: invitation.id,
                link: invitationLink(window.location.origin, invitation.token),
                role: invitation.role,
                expiresAt: invitation.expires_at,
            },
        ]);
    };

    const create = () =>
        run((val) => createLink(val, role), createInvitationError);

    // a new invitation for the same role first, so that a failure (e.g. at
    // the limit) keeps the old one
    const renew = (invitation: Invitation) =>
        run(async (val) => {
            await createLink(val, invitation.role);
            try {
                await val.revokeInvitation(serviceId, invitation.id);
            } catch (err) {
                toast.error(renewRevokeError(err));
                return;
            }
            dropLink(invitation.id);
            toast.success(
                `Created a new ${invitation.role} link; the old one no longer works`,
            );
        }, createInvitationError);

    const revoke = (invitation: Invitation) =>
        run(async (val) => {
            await val.revokeInvitation(serviceId, invitation.id);
            dropLink(invitation.id);
            toast.success(`Revoked the ${invitation.role} invitation`);
        }, revokeInvitationError);

    const copy = (link: string) => {
        const failed = () =>
            toast.error("Cannot copy the link; select and copy it.");
        // no Clipboard API outside secure contexts
        if (!navigator.clipboard) return failed();
        navigator.clipboard
            .writeText(link)
            .then(() => toast.success("Copied the invitation link"), failed);
    };

    const busy = disabled || changing;
    const links = liveLinks(created, invitations);
    const linkOf = new Map(links.map((val) => [val.id, val.link]));
    const { open, accepted } = splitInvitations(invitations ?? []);
    const listed = showAccepted ? (invitations ?? []) : open;

    return (
        <section className="space-y-3" aria-label="Invitations">
            <div>
                <h3 className="font-medium">Invite by Link</h3>
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

            {links.length > 0 && (
                <div className="space-y-2">
                    <ul className="space-y-2" aria-label="New invitation links">
                        {links.map((val) => (
                            <li key={val.id} className="space-y-1">
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={val.link}
                                        aria-label={`Invitation link for the ${val.role} role, until ${when(val.expiresAt)}`}
                                        onFocus={(e) => e.target.select()}
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copy(val.link)}
                                        aria-label={`Copy invitation link for the ${val.role} role, until ${when(val.expiresAt)}`}
                                    >
                                        <Copy />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    For the {val.role} role, until{" "}
                                    {when(val.expiresAt)}.
                                </p>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                        Links are shown only while this dialog is open: the
                        registry keeps no copy of them. Copy them before you
                        close it; afterwards, an open invitation can only get a
                        new link.
                    </p>
                </div>
            )}

            {listFailure && (
                <p className="text-sm text-muted-foreground">{listFailure}</p>
            )}
            {invitations && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                        {open.length === 0
                            ? "No open invitations."
                            : `${open.length} open ${open.length === 1 ? "invitation" : "invitations"}.`}
                    </p>
                    {accepted.length > 0 && (
                        <Toggle
                            variant="outline"
                            size="sm"
                            pressed={showAccepted}
                            onPressedChange={setShowAccepted}
                        >
                            Show accepted ({accepted.length})
                        </Toggle>
                    )}
                </div>
            )}
            {listed.length > 0 && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invitation</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead className="w-20" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {listed.map((val) => {
                            const link = linkOf.get(val.id);
                            const name = `${val.role} invitation created ${when(val.created_at)}`;
                            return (
                                <TableRow key={val.id}>
                                    <TableCell className="max-w-0 w-full">
                                        <div className="grid leading-tight">
                                            <span className="flex items-center gap-2">
                                                <Badge variant="secondary">
                                                    {val.role}
                                                </Badge>
                                                {val.accepted
                                                    ? "Accepted"
                                                    : "Open"}
                                            </span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {val.accepted
                                                    ? `by ${acceptanceLabel(val.accepted)}, ${when(val.accepted.accepted_at)}`
                                                    : `created ${when(val.created_at)}${link ? "" : ", link no longer shown"}`}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {when(val.expires_at)}
                                    </TableCell>
                                    <TableCell>
                                        {!val.accepted && (
                                            <div className="flex justify-end">
                                                {link ? (
                                                    <Button
                                                        size={"icon-sm"}
                                                        variant={"ghost"}
                                                        onClick={() =>
                                                            copy(link)
                                                        }
                                                        aria-label={`Copy link of ${name}`}
                                                    >
                                                        <Copy className="size-4" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size={"icon-sm"}
                                                        variant={"ghost"}
                                                        onClick={() =>
                                                            renew(val)
                                                        }
                                                        disabled={busy}
                                                        aria-label={`New link for ${name}`}
                                                        title="New link (revokes this one)"
                                                    >
                                                        <RefreshCw className="size-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    size={"icon-sm"}
                                                    variant={"ghost"}
                                                    onClick={() => revoke(val)}
                                                    disabled={busy}
                                                    aria-label={`Revoke ${name}`}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </section>
    );
}

export default Invitations;
