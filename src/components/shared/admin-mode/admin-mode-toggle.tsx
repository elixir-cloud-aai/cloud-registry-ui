"use client";
import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdminMode, useMe } from "@/hooks";
import { adminModeState } from "@/lib/admin-mode";
import { cn } from "@/lib/utils";

const tooltips = {
    user: "Switch to admin mode",
    admin: "Switch to user mode",
    unavailable:
        "Admin rights don't apply right now. Switch to user mode, or reload the page.",
};

// admin mode is shown only by this switch: a light red while it is on, and
// amber with a warning sign if admin rights don't apply; the colours keep a
// contrast of at least 4.5:1 in both colour schemes
const styles = {
    admin: "border-red-300 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900 dark:hover:text-red-100",
    unavailable:
        "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 hover:text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900 dark:hover:text-amber-50",
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
                    variant="outline"
                    className={cn(state !== "user" && styles[state])}
                    aria-pressed={adminMode}
                    onClick={() => setAdminMode(!adminMode)}
                >
                    {state === "unavailable" ? (
                        <TriangleAlert />
                    ) : (
                        <ArrowLeftRight />
                    )}
                    {adminMode ? "Admin mode" : "User mode"}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tooltips[state]}</TooltipContent>
        </Tooltip>
    );
}
