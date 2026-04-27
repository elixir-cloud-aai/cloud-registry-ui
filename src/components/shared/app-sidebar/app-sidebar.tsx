"use client";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Info, Layers, LayoutDashboard, Pencil, PlusCircle, Wrench } from "lucide-react";
import Link from "next/link";
import { AppSidebarFooter } from "./app-sidebar-footer";
import AppSidebarHeader from "./app-sidebar-header";

const data = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Services", url: "/dashboard/services", icon: Wrench },
    { title: "Service Types", url: "/dashboard/service-types", icon: Layers },
    { title: "Service Info", url: "/dashboard/service-info", icon: Info },
    { title: "Create Service", url: "/dashboard/create-service", icon: PlusCircle },
    { title: "Update Service", url: "/dashboard/update-service", icon: Pencil },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon">
            {/* Sidebar header */}
            <SidebarHeader>
                <AppSidebarHeader />
            </SidebarHeader>

            {/* Sidebar Content */}
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {data.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild>
                                    <Link
                                        href={item.url}
                                        className="flex items-center gap-2 font-medium"
                                    >
                                        <item.icon className="h-4 w-4" />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            {/* Sidebar footer */}
            <SidebarFooter>
                <AppSidebarFooter />
            </SidebarFooter>
        </Sidebar>
    );
}
