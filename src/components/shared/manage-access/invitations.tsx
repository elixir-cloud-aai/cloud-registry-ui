"use client";
import { Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import type { Invitation, Role } from "@/lib/cloud-registry.types";
import {
    createInvitationError,
    invitationLink,
    listInvitationsError,
    openInvitations,
    renewInvitationError,
    renewRevokeError,
    revokeInvitationError,
} from "@/lib/invitations";
import type { AccessProvider } from "./access-helper";
import InvitationTable from "./invitation-table";
import RoleSelect from "./role-select";

type Props = {
    provider: AccessProvider | null;
    serviceId: string;
    /** Invitations per page */
    pageSize: number;
    disabled?: boolean;
    /** Called when a change starts and ends, e.g. to keep a dialog open */
    onChanging?: (changing: boolean) => void;
    /** Called with the number of open invitations; undefined if not known */
    onCountChange?: (count: number | undefined) => void;
};

/**
 * Invitations to a service: create a link for a role, list the open
 * invitations, newest first and in pages, give them a new link, and revoke
 * them. The links created while the component is shown stay available;
 * the registry stores only hashes of the tokens, so no others are known.
 * Requests and their messages are here, the list in `InvitationTable`
 */
function Invitations({
    provider,
    serviceId,
    pageSize,
    disabled = false,
    onChanging,
    onCountChange,
}: Props) {
    const [invitations, setInvitations] = useState<Invitation[] | null>(null);
    const [listFailure, setListFailure] = useState<string>();
    const [role, setRole] = useState<Role>("maintainer");
    const [changing, setChanging] = useState(false);
    // the links created here, by invitation; their tokens are only known now
    const [links, setLinks] = useState<ReadonlyMap<string, string>>(new Map());
    const latestRequest = useRef(0);
    const open = openInvitations(invitations ?? []);
    const count = invitations ? open.length : undefined;
    // here, as a new link goes back to the first page, where it is listed
    const [page, setPage] = useState(1);

    useEffect(() => {
        onCountChange?.(count);
        // not known once the dialog closes, until the list is loaded again
        return () => onCountChange?.(undefined);
    }, [count, onCountChange]);

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

    const createLink = async (val: AccessProvider, linkRole: Role) => {
        const invitation = await val.createInvitation(serviceId, {
            role: linkRole,
        });
        setLinks((current) =>
            new Map(current).set(
                invitation.id,
                invitationLink(window.location.origin, invitation.token),
            ),
        );
        // the newest invitation is the first one
        setPage(1);
    };

    const create = () =>
        run(async (val) => {
            await createLink(val, role);
            toast.success(
                `Created a ${role} link; copy it before you close this dialog`,
            );
        }, createInvitationError);

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
            toast.success(
                `Created a new ${invitation.role} link; the old one no longer works`,
            );
        }, renewInvitationError);

    const revoke = (invitation: Invitation) =>
        run(async (val) => {
            await val.revokeInvitation(serviceId, invitation.id);
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

    return (
        <div className="space-y-3">
            <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                    Send a link to a colleague: when they log in and accept it,
                    they get the role. Each link works once and expires.
                </p>
                <p>
                    Links aren't kept, so copy a link before you close this
                    dialog. An open invitation can get a new link, which stops
                    the old one working.
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

            {listFailure && (
                <p className="text-sm text-muted-foreground">{listFailure}</p>
            )}
            {invitations && (
                <InvitationTable
                    invitations={open}
                    links={links}
                    pageSize={pageSize}
                    page={page}
                    onPageChange={setPage}
                    disabled={busy}
                    onCopy={copy}
                    onRenew={renew}
                    onRevoke={revoke}
                />
            )}
        </div>
    );
}

export default Invitations;
