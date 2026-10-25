import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { ClockIcon } from "lucide-react";
import { typeLabel } from "@/lib/service-types";

type Props = {
    serviceType: ServiceType;
    admin?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
};

// users other than admins can only change pending services to an approved
// type (owners and maintainers), or delete them (owners)
function hint(admin: boolean, canEdit: boolean, canDelete: boolean) {
    if (admin) return " Approve it before verifying it.";
    if (canEdit && canDelete)
        return " Until then, it can only be changed to an approved type, or deleted.";
    if (canEdit)
        return " Until then, it can only be changed to an approved type.";
    if (canDelete) return " Until then, it can only be deleted.";
    return "";
}

function PendingBanner({
    serviceType,
    admin = false,
    canEdit = false,
    canDelete = false,
}: Props) {
    return (
        <div
            role="status"
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
            <ClockIcon className="size-4 mt-0.5 shrink-0" />
            <p>
                This service awaits the approval of its service type{" "}
                <span className="font-medium break-words">
                    {typeLabel(serviceType)}
                </span>{" "}
                by an admin: only admins and users with a role on it see it.
                {hint(admin, canEdit, canDelete)}
            </p>
        </div>
    );
}

export default PendingBanner;
