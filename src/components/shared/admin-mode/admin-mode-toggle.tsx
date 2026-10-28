"use client";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdminMode, useMe } from "@/hooks";
import { adminModeState } from "@/lib/admin-mode";

const tooltips = {
    user: "Switch to admin mode",
    admin: "Switch to user mode",
    unavailable:
        "Admin rights don't apply right now. Switch to user mode, or reload the page.",
};

export function AdminModeToggle() {
    const { me, loading } = useMe();
    const { adminMode, setAdminMode } = useAdminMode();

    // in admin mode, the switch back shows also while the user loads
    const state =
        adminMode && loading ? "admin" : adminModeState(me, adminMode);
    if (!state) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    size="sm"
                    variant={
                        state === "unavailable"
                            ? "destructive"
                            : adminMode
                              ? "default"
                              : "outline"
                    }
                    aria-pressed={adminMode}
                    onClick={() => setAdminMode(!adminMode)}
                >
                    <ArrowLeftRight />
                    {adminMode ? "Admin mode" : "User mode"}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tooltips[state]}</TooltipContent>
        </Tooltip>
    );
}
