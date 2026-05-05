import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "../theme";

function AppTopbarActions() {
    return (
        <div className="flex items-center gap-2">
            <Tooltip>
                <TooltipTrigger>
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/service-info">
                            <Info className="h-4 w-4" />
                        </Link>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Service Info</TooltipContent>
            </Tooltip>

            <ThemeToggle />
        </div>
    );
}

export default AppTopbarActions;
