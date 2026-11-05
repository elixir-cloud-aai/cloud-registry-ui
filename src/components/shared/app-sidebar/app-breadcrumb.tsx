import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { appTitle } from "@/lib/branding";
import { BreadcrumbClient } from "./breadcrumb-client";

function AppBreadcrumb() {
    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/dashboard">
                        {appTitle}
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="block truncate">
                        {<BreadcrumbClient />}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );
}

export default AppBreadcrumb;
