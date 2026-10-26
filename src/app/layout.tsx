import type { Metadata } from "next";
import { Inter, Open_Sans } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appTitle } from "@/lib/branding";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const openSans = Open_Sans({
    subsets: ["latin"],
    weight: ["600"],
    variable: "--font-title",
});

export const metadata: Metadata = {
    title: appTitle,
    description: "Register and find services",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // set by `src/proxy.ts`, for the theme's inline script; reading it
    // renders every page per request, which the nonce needs
    const nonce = (await headers()).get("x-nonce") ?? undefined;

    return (
        <html
            lang="en"
            className={cn(
                "h-full",
                "antialiased",
                "font-sans",
                inter.variable,
                openSans.variable,
            )}
            suppressHydrationWarning
        >
            <body className="min-h-full flex flex-col">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange={false}
                    nonce={nonce}
                >
                    <TooltipProvider>{children}</TooltipProvider>
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
