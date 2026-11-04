"use client";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { Invitation } from "@/lib/cloud-registry.types";
import { isExpiredInvitation } from "@/lib/invitations";
import { cn } from "@/lib/utils";

type Props = {
    /** Invitations to show, in that order */
    invitations: Invitation[];
    /** Links that are known, by invitation */
    links: ReadonlyMap<string, string>;
    disabled?: boolean;
    onCopy: (link: string) => void;
    onRenew: (invitation: Invitation) => void;
    /** Revokes an open invitation, or removes an expired one */
    onRevoke: (invitation: Invitation) => void;
};

/** Date and time in the user's locale */
const when = (value: string) => new Date(value).toLocaleString();

/**
 * Invitations, by their label: each with a button that copies its link, if
 * known and it hasn't expired, or else gets it a new one, and a button that
 * revokes or removes it. Labels are text from users, and shown as such
 */
function InvitationTable({
    invitations,
    links,
    disabled = false,
    onCopy,
    onRenew,
    onRevoke,
}: Props) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Invitation</TableHead>
                    {/* on phones, in the row's first cell instead */}
                    <TableHead className="hidden sm:table-cell">
                        Expires
                    </TableHead>
                    <TableHead className="w-20" />
                </TableRow>
            </TableHeader>
            <TableBody>
                {invitations.map((val) => {
                    const expired = isExpiredInvitation(val);
                    const link = expired ? undefined : links.get(val.id);
                    const what = val.label
                        ? `${val.role} invitation "${val.label}"`
                        : `${val.role} invitation`;
                    const name = `${what} created ${when(val.createdAt)}`;
                    return (
                        <TableRow key={val.id}>
                            <TableCell className="max-w-0 w-full">
                                {/* a track that doesn't grow with the label */}
                                <div className="grid grid-cols-[minmax(0,1fr)] leading-tight">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span
                                            className={cn(
                                                // `pr-px`: italics lean out
                                                "min-w-0 truncate pr-px",
                                                !val.label &&
                                                    "text-muted-foreground italic",
                                            )}
                                            title={val.label}
                                        >
                                            {val.label || "No label"}
                                        </span>
                                        <Badge variant="secondary">
                                            {val.role}
                                        </Badge>
                                        {expired && (
                                            <Badge variant="destructive">
                                                Expired
                                            </Badge>
                                        )}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        created {when(val.createdAt)}
                                        {!expired && !link && (
                                            <span className="hidden sm:inline">
                                                , link no longer shown
                                            </span>
                                        )}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground sm:hidden">
                                        expires {when(val.expiresAt)}
                                    </span>
                                    {!expired && !link && (
                                        <span className="truncate text-xs text-muted-foreground sm:hidden">
                                            link no longer shown
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="hidden text-xs sm:table-cell">
                                {when(val.expiresAt)}
                            </TableCell>
                            <TableCell>
                                <div className="flex justify-end">
                                    {link ? (
                                        <Button
                                            size={"icon-sm"}
                                            variant={"ghost"}
                                            onClick={() => onCopy(link)}
                                            aria-label={`Copy link of ${name}`}
                                        >
                                            <Copy className="size-4" />
                                        </Button>
                                    ) : (
                                        <Button
                                            size={"icon-sm"}
                                            variant={"ghost"}
                                            onClick={() => onRenew(val)}
                                            disabled={disabled}
                                            aria-label={`New link for ${name}`}
                                            title={
                                                expired
                                                    ? "New link (removes this one)"
                                                    : "New link (revokes this one)"
                                            }
                                        >
                                            <RefreshCw className="size-4" />
                                        </Button>
                                    )}
                                    <Button
                                        size={"icon-sm"}
                                        variant={"ghost"}
                                        onClick={() => onRevoke(val)}
                                        disabled={disabled}
                                        aria-label={`${expired ? "Remove" : "Revoke"} ${name}`}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

export default InvitationTable;
