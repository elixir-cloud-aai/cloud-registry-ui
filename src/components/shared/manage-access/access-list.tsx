"use client";
import { Trash2, Users } from "lucide-react";
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
import type {
    GroupPermission,
    Permission,
    Role,
    ServicePermissions,
} from "@/lib/cloud-registry.types";
import { isGroup } from "./access-helper";
import RoleSelect from "./role-select";

type Props = {
    permissions: ServicePermissions;
    currentUserId?: string;
    disabled?: boolean;
    onRoleChange: (val: Permission | GroupPermission, role: Role) => void;
    onRevoke: (val: Permission | GroupPermission) => void;
};

function AccessList({
    permissions,
    currentUserId,
    disabled = false,
    onRoleChange,
    onRevoke,
}: Props) {
    if (permissions.length === 0)
        return (
            <p className="text-sm text-muted-foreground">No roles granted.</p>
        );

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>User or group</TableHead>
                    <TableHead className="w-36">Role</TableHead>
                    <TableHead className="w-12" />
                </TableRow>
            </TableHeader>
            <TableBody>
                {permissions.map((val) => {
                    const key = isGroup(val)
                        ? `group:${val.group}`
                        : `user:${val.user_id}`;
                    const label = isGroup(val) ? val.group : val.user_id;

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
                                ) : (
                                    <div className="grid leading-tight">
                                        <span className="truncate font-medium">
                                            {val.name || "User"}
                                            {val.user_id === currentUserId &&
                                                " (you)"}
                                        </span>
                                        <span className="truncate font-mono text-xs text-muted-foreground">
                                            {val.user_id}
                                        </span>
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>
                                <RoleSelect
                                    value={val.role}
                                    onChange={(role) => onRoleChange(val, role)}
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
    );
}

export default AccessList;
