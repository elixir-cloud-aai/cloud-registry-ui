"use client";
import type { Service } from "@elixir-cloud/cloud-registry/providers";
import { BookOpen, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { safeHref } from "@/lib/links";

type Props = {
    serviceInfo: Service;
};

function ServiceInfoCardHeader({ serviceInfo }: Props) {
    if (serviceInfo === undefined) return null;
    const documentationUrl = safeHref(serviceInfo.documentationUrl);
    const contactUrl = safeHref(serviceInfo.contactUrl, true);
    return (
        <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        {serviceInfo.name}
                        {serviceInfo.environment && (
                            <Badge
                                variant={
                                    serviceInfo.environment === "dev"
                                        ? "outline"
                                        : "default"
                                }
                                className="capitalize"
                            >
                                {serviceInfo.environment}
                            </Badge>
                        )}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">
                        ID: {serviceInfo.id}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    {documentationUrl && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <a
                                    href={documentationUrl}
                                    target="_blank"
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                    rel="noopener"
                                >
                                    <BookOpen className="w-4 h-4 text-slate-500" />
                                </a>
                            </TooltipTrigger>
                            <TooltipContent>Documentation Url</TooltipContent>
                        </Tooltip>
                    )}
                    {contactUrl && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <a
                                    href={contactUrl}
                                    target="_blank"
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                    rel="noopener"
                                >
                                    <ExternalLink className="w-4 h-4 text-slate-500" />
                                </a>
                            </TooltipTrigger>
                            <TooltipContent>Contact Url</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
        </CardHeader>
    );
}

export default ServiceInfoCardHeader;
