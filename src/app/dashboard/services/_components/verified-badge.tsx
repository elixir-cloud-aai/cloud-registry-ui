import { BadgeCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function VerifiedBadge() {
    return (
        <Badge variant={"secondary"}>
            <BadgeCheckIcon data-icon="inline-start" />
            Verified
        </Badge>
    );
}

export default VerifiedBadge;
