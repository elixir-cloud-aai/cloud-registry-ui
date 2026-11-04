import type { Metadata } from "next";
import { Inter, Open_Sans } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appTitle } from "@/lib/branding";
import { publicSettingsScript } from "@/lib/public-settings";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const openSans = Open_Sans({
    subsets: ["latin"],
    weight: ["600"],
    variable: "--font-title",
});

// not at build time, as the title is read when the server runs
export function generateMetadata(): Metadata {
    return {
        title: appTitle,
        description: "Register and find services",
    };
}

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
                {/* the settings of this deployment, before the app's
                    scripts run (see `public-settings.ts`) */}
                <Script
                    id="public-settings"
                    strategy="beforeInteractive"
                    nonce={nonce}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON of the public settings, with `<` escaped
                    dangerouslySetInnerHTML={{ __html: publicSettingsScript() }}
                />
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
