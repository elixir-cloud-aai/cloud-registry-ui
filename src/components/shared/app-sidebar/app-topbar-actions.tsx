import { Info, LogIn } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { AdminModeToggle } from "../admin-mode";
import { ThemeToggle } from "../theme";
import { getCookie } from "cookies-next/server";
import { cookies } from "next/headers";

async function AppTopbarActions() {
    const idToken = await getCookie("id_token", { cookies });

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

            {idToken && <AdminModeToggle />}

            {!idToken && (
                <Button size="sm" asChild>
                    <Link href={"/auth/login"}>
                        <LogIn />
                        Log in
                    </Link>
                </Button>
            )}
        </div>
    );
}

export default AppTopbarActions;
