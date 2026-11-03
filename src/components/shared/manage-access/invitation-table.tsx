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

type Props = {
    /** Invitations to show, in that order */
    invitations: Invitation[];
    /** Links that are known, by invitation */
    links: ReadonlyMap<string, string>;
    disabled?: boolean;
    onCopy: (link: string) => void;
    onRenew: (invitation: Invitation) => void;
    onRevoke: (invitation: Invitation) => void;
};

/** Date and time in the user's locale */
const when = (value: string) => new Date(value).toLocaleString();

/**
 * Open invitations: each with a button that copies its link, if known, or
 * else gets it a new one, and a button that revokes it
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
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-20" />
                </TableRow>
            </TableHeader>
            <TableBody>
                {invitations.map((val) => {
                    const link = links.get(val.id);
                    const name = `${val.role} invitation created ${when(val.created_at)}`;
                    return (
                        <TableRow key={val.id}>
                            <TableCell className="max-w-0 w-full">
                                <div className="grid leading-tight">
                                    <span className="flex items-center gap-2">
                                        <Badge variant="secondary">
                                            {val.role}
                                        </Badge>
                                        Open
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        created {when(val.created_at)}
                                        {!link && ", link no longer shown"}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="text-xs">
                                {when(val.expires_at)}
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
                                            title="New link (revokes this one)"
                                        >
                                            <RefreshCw className="size-4" />
                                        </Button>
                                    )}
                                    <Button
                                        size={"icon-sm"}
                                        variant={"ghost"}
                                        onClick={() => onRevoke(val)}
                                        disabled={disabled}
                                        aria-label={`Revoke ${name}`}
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
