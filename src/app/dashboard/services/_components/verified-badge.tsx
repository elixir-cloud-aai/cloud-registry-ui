import { BadgeCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function VerifiedBadge() {
    return (
        <Badge
            variant={"secondary"}
            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        >
            <BadgeCheckIcon data-icon="inline-start" />
            Verified
        </Badge>
    );
}

export default VerifiedBadge;
