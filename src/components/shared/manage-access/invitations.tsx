"use client";
import { Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { usePagination } from "@/hooks";
import type { Invitation, Role } from "@/lib/cloud-registry.types";
import {
    createInvitationError,
    createLabelledInvitation,
    invitationLabelError,
    invitationLink,
    invitationStatus,
    isDeadInvitation,
    isExpiredInvitation,
    listInvitationsError,
    removedExpiredMessage,
    removeExpiredError,
    removeInvitationError,
    removeInvitations,
    renewInvitationError,
    renewRemoveError,
    renewRevokeError,
    revokeInvitationError,
    shownInvitations,
} from "@/lib/invitations";
import type { AccessProvider } from "./access-helper";
import InvitationTable from "./invitation-table";
import RemoveExpiredButton from "./remove-expired-button";
import RoleSelect from "./role-select";

type Props = {
    provider: AccessProvider | null;
    serviceId: string;
    /** Invitations per page */
    pageSize: number;
    /** Whether new invitations need a label */
    labelRequired: boolean;
    disabled?: boolean;
    /** Called when a change starts and ends, e.g. to keep a dialog open */
    onChanging?: (changing: boolean) => void;
    /** Called with the number of open invitations; undefined if not known */
    onCountChange?: (count: number | undefined) => void;
};

/** An invitation created here, with its link */
type CreatedLink = {
    invitation: Invitation;
    link: string;
};

/**
 * Invitations to a service: create a link for a role, with a label, list the
 * open and expired invitations, newest first and in pages, give them a new
 * link, and revoke or remove them. The links created while the component is
 * shown stay available; the registry stores only hashes of the tokens, so no
 * others are known.
 * Requests and their messages are here, the list in `InvitationTable`
 */
function Invitations({
    provider,
    serviceId,
    pageSize,
    labelRequired,
    disabled = false,
    onChanging,
    onCountChange,
}: Props) {
    const [invitations, setInvitations] = useState<Invitation[] | null>(null);
    const [listFailure, setListFailure] = useState<string>();
    const [role, setRole] = useState<Role>("maintainer");
    const [label, setLabel] = useState("");
    const [labelError, setLabelError] = useState<string>();
    const labelField = useRef<HTMLInputElement>(null);
    const [changing, setChanging] = useState(false);
    // the invitations created here, with their links: their tokens are only
    // known now
    const [created, setCreated] = useState<CreatedLink[]>([]);
    // the link that couldn't be copied, shown to be selected instead
    const [uncopied, setUncopied] = useState<string>();
    const latestRequest = useRef(0);
    // browsers copy in the background: only the latest result counts, and none
    // once the invitations changed
    const latestCopy = useRef(0);
    // without a list, those created here, so that their links stay available
    const shown = shownInvitations(
        invitations ?? created.map((val) => val.invitation),
    );
    const expired = shown.filter(isExpiredInvitation);
    const links = new Map(created.map((val) => [val.invitation.id, val.link]));
    // a link stops working with its invitation
    const selectable = created.some((val) => val.link === uncopied);
    const uncopiedField = useRef<HTMLInputElement>(null);
    // the open ones: the others need nothing but removing
    const count = invitations ? shown.length - expired.length : undefined;
    // the registry lists all invitations at once: paged here
    const { page, pageCount, pageItems, setPage } = usePagination(
        shown,
        pageSize,
    );

    // in view and selected, as the message about it asks to select it
    useEffect(() => {
        if (uncopied) uncopiedField.current?.focus();
    }, [uncopied]);

    useEffect(() => {
        onCountChange?.(count);
    }, [count, onCountChange]);

    // not known once the dialog closes, until the list is loaded again
    useEffect(() => () => onCountChange?.(undefined), [onCountChange]);

    const fetchInvitations = useCallback(() => {
        if (!provider) return Promise.resolve();
        const request = ++latestRequest.current;
        return provider
            .getServiceInvitations(serviceId)
            .then((val) => {
                if (request !== latestRequest.current) return;
                setInvitations(val);
                setListFailure(undefined);
                // links of invitations that were accepted, revoked or expired
                // no longer work, also if a later list can't be loaded
                const open = new Set(
                    val
                        .filter((item) => invitationStatus(item) === "open")
                        .map(({ id }) => id),
                );
                setCreated((current) =>
                    current.filter(({ invitation }) => open.has(invitation.id)),
                );
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
        latestCopy.current++;
        setUncopied(undefined);
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
        setCreated((current) =>
            current.filter((val) => val.invitation.id !== id),
        );

    // tells whether the label was kept: registries up to cloud-registry
    // 1.0.0rc1 have no labels
    const createLink = async (
        val: AccessProvider,
        linkRole: Role,
        linkLabel?: string,
    ) => {
        const { created: result, labelKept } = await createLabelledInvitation(
            (invitation) => val.createInvitation(serviceId, invitation),
            linkRole,
            linkLabel,
        );
        const { token, ...invitation } = result;
        setCreated((current) => [
            ...current,
            {
                invitation,
                link: invitationLink(window.location.origin, token),
            },
        ]);
        // the newest invitation is the first one
        setPage(1);
        return labelKept;
    };

    const create = () => {
        const problem = invitationLabelError(label, labelRequired);
        setLabelError(problem);
        if (problem) {
            labelField.current?.focus();
            return;
        }
        run(async (val) => {
            const labelKept = await createLink(
                val,
                role,
                label.trim() || undefined,
            );
            setLabel("");
            if (labelKept)
                toast.success(
                    `Created a ${role} link; copy it before you close this dialog`,
                );
            else
                toast.success(
                    `Created a ${role} link without its label, as this registry has no labels; copy it before you close this dialog`,
                    {
                        description:
                            "This registry is too old for this version of the app: don't change the roles of users until its admins upgrade it.",
                        duration: 10000,
                    },
                );
        }, createInvitationError);
    };

    // a new invitation for the same role and label first, so that a failure
    // (e.g. at the limit) keeps the old one. Rows offer this only for
    // invitations whose link isn't known, so no known link gets lost
    const renew = (invitation: Invitation) => {
        const dead = isExpiredInvitation(invitation);
        run(
            async (val) => {
                await createLink(val, invitation.role, invitation.label);
                try {
                    await val.revokeInvitation(serviceId, invitation.id);
                } catch (err) {
                    toast.error(
                        dead ? renewRemoveError(err) : renewRevokeError(err),
                    );
                    return;
                }
                toast.success(
                    dead
                        ? `Created a new ${invitation.role} link and removed the expired invitation`
                        : `Created a new ${invitation.role} link; the old one no longer works`,
                );
            },
            (err) => renewInvitationError(err, dead),
        );
    };

    const revoke = (invitation: Invitation) => {
        const dead = isExpiredInvitation(invitation);
        run(
            async (val) => {
                try {
                    await val.revokeInvitation(serviceId, invitation.id);
                } catch (err) {
                    if (isDeadInvitation(err)) dropLink(invitation.id);
                    throw err;
                }
                dropLink(invitation.id);
                toast.success(
                    dead
                        ? `Removed the expired ${invitation.role} invitation`
                        : `Revoked the ${invitation.role} invitation`,
                );
            },
            dead ? removeInvitationError : revokeInvitationError,
        );
    };

    const removeExpired = () => {
        // of all pages
        const removing = expired;
        run(async (val) => {
            const failures = await removeInvitations(removing, (id) =>
                val.revokeInvitation(serviceId, id),
            );
            if (failures.length)
                toast.error(removeExpiredError(removing.length, failures));
            else toast.success(removedExpiredMessage(removing.length));
        }, removeInvitationError);
    };

    const copy = (link: string) => {
        const request = ++latestCopy.current;
        const failed = () => {
            if (request === latestCopy.current) setUncopied(link);
            toast.error("Cannot copy the link; select and copy it.");
        };
        // no Clipboard API outside secure contexts
        if (!navigator.clipboard) return failed();
        navigator.clipboard.writeText(link).then(() => {
            if (request === latestCopy.current) setUncopied(undefined);
            toast.success("Copied the invitation link");
        }, failed);
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
                    dialog. An invitation can get a new link, which stops the
                    old one working.
                </p>
            </div>

            <form
                className="space-y-1"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!busy && invitations) create();
                }}
            >
                <div className="flex flex-wrap items-end gap-3">
                    <Field className="w-36">
                        <FieldLabel htmlFor="invitation-role">Role</FieldLabel>
                        <RoleSelect
                            id="invitation-role"
                            value={role}
                            onChange={setRole}
                            disabled={busy || !invitations}
                        />
                    </Field>
                    <Field
                        className="w-auto min-w-40 flex-1"
                        data-invalid={!!labelError}
                    >
                        <FieldLabel htmlFor="invitation-label">
                            {labelRequired ? "Label" : "Label (optional)"}
                        </FieldLabel>
                        <Input
                            ref={labelField}
                            id="invitation-label"
                            value={label}
                            placeholder="Who is it for?"
                            autoComplete="off"
                            aria-required={labelRequired}
                            aria-invalid={!!labelError}
                            aria-describedby={
                                labelError
                                    ? "invitation-label-error"
                                    : undefined
                            }
                            disabled={busy || !invitations}
                            onChange={(e) => {
                                setLabel(e.target.value);
                                setLabelError(undefined);
                            }}
                        />
                    </Field>
                    <Button type="submit" disabled={busy || !invitations}>
                        <Link2 />
                        Create link
                    </Button>
                </div>
                {labelError && (
                    <FieldError id="invitation-label-error">
                        {labelError}
                    </FieldError>
                )}
            </form>

            {listFailure && (
                <p className="text-sm text-muted-foreground">{listFailure}</p>
            )}
            {selectable && (
                <Input
                    ref={uncopiedField}
                    readOnly
                    value={uncopied}
                    aria-label="Invitation link"
                    onFocus={(e) => e.target.select()}
                />
            )}
            {invitations && shown.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No open invitations.
                </p>
            )}
            {shown.length > 0 && (
                <InvitationTable
                    invitations={pageItems}
                    links={links}
                    // what the list doesn't show may have changed
                    disabled={busy || !invitations}
                    onCopy={copy}
                    onRenew={renew}
                    onRevoke={revoke}
                />
            )}
            {(expired.length > 0 || pageCount > 1) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {expired.length > 0 ? (
                        <RemoveExpiredButton
                            count={expired.length}
                            // what the list doesn't show may have changed
                            disabled={busy || !invitations}
                            onConfirm={removeExpired}
                        />
                    ) : (
                        <span />
                    )}
                    <ListPagination
                        className="mx-0 w-auto"
                        page={page}
                        pageCount={pageCount}
                        onPageChange={setPage}
                    />
                </div>
            )}
        </div>
    );
}

export default Invitations;
