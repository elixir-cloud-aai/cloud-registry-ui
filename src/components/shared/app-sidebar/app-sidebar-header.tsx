import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import Image from "next/image";

function AppSidebarHeader() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild isActive>
                    <div>
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                            <Image src={"/logo.svg"} width={40} height={40} alt="icon" />
                        </div>
                        <div className="flex flex-col gap-0.5 leading-none">
                            <span className="font-medium">Elixir Cloud AAI</span>
                            <span className="text-xs">Cloud Registry</span>
                        </div>
                    </div>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

export default AppSidebarHeader;
