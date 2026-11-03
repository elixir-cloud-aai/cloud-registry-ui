"use client";
import { Search, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { ListPagination } from "@/components/shared/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks";
import type {
    GroupPermission,
    Permission,
    Role,
    ServicePermissions,
} from "@/lib/cloud-registry.types";
import { filterHolders, isGroup, userName } from "./access-helper";
import RoleSelect from "./role-select";

type Props = {
    permissions: ServicePermissions;
    /** Users and groups per page */
    pageSize: number;
    currentUserId?: string;
    disabled?: boolean;
    onRoleChange: (val: Permission | GroupPermission, role: Role) => void;
    onRevoke: (val: Permission | GroupPermission) => void;
};

function AccessList({
    permissions,
    pageSize,
    currentUserId,
    disabled = false,
    onRoleChange,
    onRevoke,
}: Props) {
    const [query, setQuery] = useState("");
    // a search only where the list pages; a search left over from a longer
    // list mustn't hide holders without a box to clear it
    const searchable = permissions.length > pageSize;
    const found = filterHolders(permissions, searchable ? query : "");
    // the registry lists all roles at once: paged here
    const { page, pageCount, pageItems, start, end, setPage } = usePagination(
        found,
        pageSize,
    );

    if (permissions.length === 0)
        return (
            <p className="text-sm text-muted-foreground">No roles granted.</p>
        );

    return (
        <div className="space-y-2">
            {searchable && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search users and groups"
                            aria-label="Search users and groups"
                            className="pl-8"
                        />
                    </div>
                    <p
                        className="text-xs text-muted-foreground"
                        aria-live="polite"
                    >
                        {found.length === 0
                            ? `None of ${permissions.length}`
                            : `${start + 1}–${end} of ${found.length}`}
                        {found.length !== permissions.length &&
                            found.length > 0 &&
                            ` (of ${permissions.length})`}
                    </p>
                </div>
            )}
            {found.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No users or groups match.
                </p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User or group</TableHead>
                            <TableHead className="w-36">Role</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageItems.map((val) => {
                            const key = isGroup(val)
                                ? `group:${val.group}`
                                : `user:${val.user_id}`;
                            const label = isGroup(val)
                                ? val.group
                                : val.user_id;
                            const name = isGroup(val)
                                ? undefined
                                : userName(val);
                            const you =
                                !isGroup(val) && val.user_id === currentUserId;

                            return (
                                <TableRow key={key}>
                                    <TableCell className="max-w-0 w-full">
                                        {isGroup(val) ? (
                                            <div className="flex items-center gap-2">
                                                <Users className="size-4 shrink-0 text-muted-foreground" />
                                                <span className="truncate font-mono text-xs">
                                                    {val.group}
                                                </span>
                                                <Badge variant={"secondary"}>
                                                    Group
                                                </Badge>
                                            </div>
                                        ) : name ? (
                                            <div className="grid leading-tight">
                                                <span className="truncate font-medium">
                                                    {name}
                                                    {you && " (you)"}
                                                </span>
                                                <span className="truncate font-mono text-xs text-muted-foreground">
                                                    {val.user_id}
                                                </span>
                                            </div>
                                        ) : (
                                            // no name until the user has used the
                                            // registry: the ID alone
                                            <span
                                                className="block truncate font-mono text-xs"
                                                title={val.user_id}
                                            >
                                                {val.user_id}
                                                {you && (
                                                    <span className="font-sans font-medium">
                                                        {" "}
                                                        (you)
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <RoleSelect
                                            value={val.role}
                                            onChange={(role) =>
                                                onRoleChange(val, role)
                                            }
                                            label={`Role of ${label}`}
                                            size="sm"
                                            disabled={disabled}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            size={"icon-sm"}
                                            variant={"ghost"}
                                            onClick={() => onRevoke(val)}
                                            disabled={disabled}
                                            aria-label={`Remove ${label}`}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
            <ListPagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
            />
        </div>
    );
}

export default AccessList;
