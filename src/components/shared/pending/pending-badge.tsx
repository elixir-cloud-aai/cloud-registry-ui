import { ClockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function PendingBadge() {
    return (
        <Badge
            variant={"secondary"}
            className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
            <ClockIcon data-icon="inline-start" />
            Pending
        </Badge>
    );
}

export default PendingBadge;
