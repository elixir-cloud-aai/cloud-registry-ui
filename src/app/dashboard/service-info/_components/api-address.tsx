"use client";
import { Copy, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { publicSetting } from "@/lib/public-settings";
import { apiAddress } from "./api-address-helper";

/**
 * Copy the API address to the clipboard, and tell the user how that went
 * @param address The address
 */
function copyAddress(address: string) {
    const failed = () =>
        toast.error("Cannot copy the API address. Select it to copy it.");
    // missing outside secure contexts (HTTPS or localhost)
    if (!navigator.clipboard) return failed();
    navigator.clipboard
        .writeText(address)
        .then(() => toast.success("Copied the API address."))
        .catch(failed);
}

/**
 * The address of the registry's API, which can be on another host than the
 * app. Renders only in the browser, after the page has loaded the service
 * info. Not a link: the base URL itself is no page of the API, which
 * answers it with a 404
 */
function ApiAddress() {
    const address = apiAddress(
        publicSetting("NEXT_PUBLIC_CLOUD_REGISTRY_URL"),
        window.location.href,
    );
    if (!address) return null;

    return (
        <section
            aria-labelledby="api-address"
            className="space-y-2 md:col-span-2"
        >
            <div className="flex items-center gap-2 text-slate-500">
                <Globe className="w-4 h-4" />
                <h3 id="api-address" className="font-medium">
                    API Address
                </h3>
            </div>
            <div className="flex items-center gap-1 pl-6">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-800 break-all">
                    {address}
                </code>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Copy API address"
                            className="shrink-0 text-slate-500"
                            onClick={() => copyAddress(address)}
                        >
                            <Copy />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy API address</TooltipContent>
                </Tooltip>
            </div>
        </section>
    );
}

export default ApiAddress;
