"use client";
import { useEffect, useState } from "react";
import { useFitText } from "@/hooks";
import { copyright, footerLogo } from "@/lib/branding";
import AppSidebarLogo from "./app-sidebar-logo";

function AppSidebarCopyright() {
    // set after mount, so that the server's and the browser's year can't
    // differ while hydrating (e.g. on New Year's Eve)
    const [year, setYear] = useState<number>();
    useEffect(() => {
        setYear(new Date().getFullYear());
    }, []);
    const text = copyright(year);
    const textRef = useFitText<HTMLParagraphElement>(14, text);

    return (
        <div className="flex items-center gap-3 px-2 pt-2 group-data-[collapsible=icon]:hidden">
            <p
                ref={textRef}
                className="min-w-0 flex-1 whitespace-nowrap text-muted-foreground"
            >
                {text}
            </p>
            <AppSidebarLogo
                logo={footerLogo}
                alt="Logo"
                width={0}
                height={0}
                className="max-w-3/5 shrink-0 rounded-md"
                backingClassName="dark:p-1"
                imageClassName="h-10 w-auto max-w-full object-contain"
            />
        </div>
    );
}

export default AppSidebarCopyright;
