import Image from "next/image";
import Link from "next/link";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { appLogo, appTitle } from "@/lib/branding";

function AppSidebarHeader() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild isActive>
                    <Link href={"/dashboard"}>
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg dark:bg-white">
                            <Image
                                src={appLogo}
                                width={40}
                                height={40}
                                alt=""
                                unoptimized
                            />
                        </div>
                        <span className="font-medium">{appTitle}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

export default AppSidebarHeader;
