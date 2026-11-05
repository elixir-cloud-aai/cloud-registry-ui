"use client";
import { TriangleAlertIcon } from "lucide-react";
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { syncFrequency } from "@/lib/service-sync";

type Props = {
    /** Time between syncs, in hours (`intervalHours`) */
    intervalHours: number;
    /** Whether the form has imported values */
    imported: boolean;
    /** Whether users changed imported values */
    modified: boolean;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
};

/** Whether to keep a new service in sync, below the create form: only for
 * imported values that users didn't change, as sync would override changes.
 * Otherwise, owners can turn sync on later, on the service's page */
function ServiceSyncChoice({
    intervalHours,
    imported,
    modified,
    checked,
    onCheckedChange,
}: Props) {
    const id = useId();
    const available = imported && !modified;

    return (
        <div className="mt-6 flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
                <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={available && checked}
                    disabled={!available}
                    onCheckedChange={(val) => onCheckedChange(val === true)}
                />
                <Label
                    htmlFor={id}
                    className="leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
                >
                    Keep this service in sync with its service info (
                    {syncFrequency(intervalHours)})
                </Label>
            </div>
            {!imported && (
                <p className="text-sm text-muted-foreground">
                    Import the service info above to use this.
                </p>
            )}
            {available && (
                <p className="text-sm text-muted-foreground">
                    The registry then replaces the service's values with those
                    of its service info, so manual changes won't last.
                </p>
            )}
            {modified && (
                <p className="flex items-start gap-2 text-sm text-destructive">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                    You changed imported values, and syncing would override
                    these changes. Change them back or import again to keep this
                    service in sync.
                </p>
            )}
        </div>
    );
}

export default ServiceSyncChoice;
