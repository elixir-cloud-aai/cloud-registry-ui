import { RefreshCwIcon, RefreshCwOffIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ServiceSync } from "@/lib/cloud-registry.types";

type Props = {
    /** As the registry computes it; undefined without sync */
    status?: ServiceSync["status"];
};

/** The label of a service with sync, next to the verified mark; services
 * without sync have none */
function SyncBadge({ status }: Props) {
    if (!status) return null;
    return status === "synced" ? (
        <Badge
            variant={"secondary"}
            className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
        >
            <RefreshCwIcon data-icon="inline-start" />
            Synced
        </Badge>
    ) : (
        <Badge
            variant={"secondary"}
            className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
            <RefreshCwOffIcon data-icon="inline-start" />
            Out of sync
        </Badge>
    );
}

export default SyncBadge;
