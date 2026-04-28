import { CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Service } from "@elixir-cloud/cloud-registry/providers";
import { Building2, Clock, Settings, Tag } from "lucide-react";

type Props = {
    serviceInfo: Service;
};

function ServiceInfoCardContent({ serviceInfo }: Props) {
    if (serviceInfo === undefined) return null;

    return (
        <CardContent className="space-y-6">
            <p className="text-sm text-slate-600 leading-relaxed">{serviceInfo.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Building2 className="w-4 h-4" />
                        <span className="font-medium">Organization</span>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <a
                                href={serviceInfo.organization.url}
                                className="text-blue-600 hover:underline block pl-6 max-w-max"
                            >
                                {serviceInfo.organization.name}
                            </a>
                        </TooltipTrigger>
                        <TooltipContent>{serviceInfo.organization.url}</TooltipContent>
                    </Tooltip>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Tag className="w-4 h-4" />
                        <span className="font-medium">Build Version</span>
                    </div>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded ml-6 text-slate-800">
                        {serviceInfo.version}
                    </code>
                </div>

                <Separator className="md:col-span-2" />

                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Settings className="w-4 h-4" />
                        <span className="font-medium">Registry Type</span>
                    </div>
                    <ul className="pl-6 space-y-1 text-xs">
                        <li>
                            <span className="text-slate-400">Artifact:</span>{" "}
                            {serviceInfo.type.artifact}
                        </li>
                        <li>
                            <span className="text-slate-400">Group:</span> {serviceInfo.type.group}
                        </li>
                        <li>
                            <span className="text-slate-400">Spec Version:</span>
                            {serviceInfo.type.version}
                        </li>
                    </ul>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">Lifecycle</span>
                    </div>
                    <div className="pl-6 text-xs text-slate-600 space-y-0.5">
                        <p>Created At: {new Date(serviceInfo.createdAt).toLocaleString()}</p>
                        <p>Updated At: {new Date(serviceInfo.updatedAt).toLocaleString()}</p>
                        <p>Environment: {serviceInfo.environment.toUpperCase()}</p>
                    </div>
                </div>
            </div>
        </CardContent>
    );
}

export default ServiceInfoCardContent;
