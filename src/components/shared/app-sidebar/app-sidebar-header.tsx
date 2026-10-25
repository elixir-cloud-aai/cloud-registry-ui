"use client";
import Link from "next/link";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useFitText } from "@/hooks";
import {
    appLogo,
    appTitle,
    appTitleFont,
    appTitleLines,
    appTitleSize,
} from "@/lib/branding";
import AppSidebarLogo from "./app-sidebar-logo";

// the button's content height (h-14 less py-2), the line heights used, and
// the largest size of a one-line title
const titleHeight = 40;
const oneLineHeight = 1.4;
const twoLineHeight = 1.2;
const oneLineMaxSize = 24;

function AppSidebarHeader() {
    const lineHeight = appTitleLines.length > 1 ? twoLineHeight : oneLineHeight;
    const fitSize =
        Math.floor((titleHeight / (lineHeight * appTitleLines.length)) * 10) /
        10;
    const maxSize =
        appTitleLines.length > 1 ? fitSize : Math.min(oneLineMaxSize, fitSize);
    const titleRef = useFitText<HTMLSpanElement>(
        Math.min(appTitleSize ?? maxSize, maxSize),
        appTitle,
    );

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton size="lg" className="gap-4" asChild isActive>
                    <Link href={"/dashboard"}>
                        <AppSidebarLogo
                            logo={appLogo}
                            alt=""
                            width={40}
                            height={40}
                            className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg"
                        />
                        <span
                            ref={titleRef}
                            className="min-w-0 flex-1 overflow-visible! font-[family-name:var(--font-title)] font-semibold [text-rendering:geometricPrecision]"
                            style={{ fontFamily: appTitleFont, lineHeight }}
                        >
                            {appTitleLines.map((line, index) => (
                                <span
                                    // biome-ignore lint/suspicious/noArrayIndexKey: the lines are fixed and may repeat, so only the index is unique
                                    key={index}
                                    className="block whitespace-nowrap"
                                >
                                    {line}
                                </span>
                            ))}
                        </span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

export default AppSidebarHeader;
