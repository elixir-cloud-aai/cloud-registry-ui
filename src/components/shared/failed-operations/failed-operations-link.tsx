import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { failuresPath } from "@/lib/failures";

/** The link to the failed operations, next to the bell, for logged-in users;
 * not on phones, where the top bar has no room for it: the bell's list links
 * there too */
function FailedOperationsLink() {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:inline-flex"
                    asChild
                >
                    <Link href={failuresPath} aria-label="Failed operations">
                        <TriangleAlert className="h-4 w-4" />
                    </Link>
                </Button>
            </TooltipTrigger>
            <TooltipContent>Failed operations</TooltipContent>
        </Tooltip>
    );
}

export { FailedOperationsLink };
