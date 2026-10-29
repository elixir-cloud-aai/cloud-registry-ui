import { getCookie } from "cookies-next/client";
import { Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";

// copying the access token puts a bearer token on the clipboard, so only
// development servers offer it (see "Copying the access token" in
// `docs/operator-guide/login.md`); Next inlines NODE_ENV at build time, so
// keep the literal comparison, which drops the item from production bundles
const canCopyToken = process.env.NODE_ENV === "development";

type Props = {
    user: User;
    userId?: string;
};

function AppSidebarFooterMenu({ user, userId }: Props) {
    const { isMobile } = useSidebar();

    const copyToken = () => {
        const token = getCookie("access_token");
        if (token && typeof token === "string") {
            navigator.clipboard
                .writeText(token as string)
                .then(() => toast.success("Token copied successfully."))
                .catch(() =>
                    toast.error("Please try again to copy the token."),
                );
        }
    };

    // a form submission, so that leaving pages with unsaved changes still
    // asks first (beforeunload), and the browser sends the Origin header;
    // built here, as the menu unmounts when an item is selected
    const logOut = () => {
        const form = document.createElement("form");
        form.method = "post";
        form.action = "/auth/api/logout";
        document.body.append(form);
        form.submit();
    };

    const copyUserId = () => {
        if (!userId) return;
        navigator.clipboard
            .writeText(userId)
            .then(() => toast.success("User ID copied successfully."))
            .catch(() => toast.error("Please try again to copy the user ID."));
    };

    return (
        <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
        >
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg">
                            {user?.name?.charAt(0) || "AN"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">
                            {user?.name || "Anonymous"}
                        </span>
                        <span className="truncate text-xs">
                            {user?.email || user?.sub}
                        </span>
                    </div>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {userId && (
                <DropdownMenuItem onClick={copyUserId}>
                    <Copy />
                    <div className="grid flex-1 leading-tight">
                        <span>Your user ID</span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                            {userId}
                        </span>
                    </div>
                </DropdownMenuItem>
            )}
            {canCopyToken && (
                <DropdownMenuItem onClick={copyToken}>
                    <Copy />
                    Copy token to Dashboard
                </DropdownMenuItem>
            )}
            {/* only between items, e.g. not without a user ID in production */}
            {(userId || canCopyToken) && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={logOut} className="text-red-500">
                <LogOut />
                Log out
            </DropdownMenuItem>
        </DropdownMenuContent>
    );
}

export default AppSidebarFooterMenu;
