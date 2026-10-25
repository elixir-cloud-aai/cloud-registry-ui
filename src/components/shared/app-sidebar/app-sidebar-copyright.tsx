"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { copyright, footerLogo } from "@/lib/branding";

function AppSidebarCopyright() {
    // the page is prerendered at build time, so the year is set after mount
    const [year, setYear] = useState<number>();
    useEffect(() => {
        setYear(new Date().getFullYear());
    }, []);

    return (
        <div className="flex flex-col items-center gap-2 px-2 pt-2 group-data-[collapsible=icon]:hidden">
            <div className="w-full rounded-md dark:bg-white dark:p-2">
                <Image
                    src={footerLogo}
                    width={0}
                    height={0}
                    sizes="100%"
                    alt="Logo"
                    className="w-full h-auto"
                    unoptimized
                />
            </div>
            <p className="text-xs text-muted-foreground">{copyright(year)}</p>
        </div>
    );
}

export default AppSidebarCopyright;
