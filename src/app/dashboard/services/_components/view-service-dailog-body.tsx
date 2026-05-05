"use client";
import { Button } from "@/components/ui/button";
import { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { BuildingIcon, ClockIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, SectionCard } from "./service-dailog-card-misc";

type Props = {
    service: ExternalService;
};

function ViewServiceDialogBody({ service }: Props) {
    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(service, null, 2));
        toast.success("Copied to clipboard");
    };
    return (
        <div className="px-6 py-5 overflow-y-auto max-h-[60vh] flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
                <Field label="Service ID" value={service.id} />
                <Field label="Environment" value={service.environment} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Field label="Display Name" value={service.name} />
                <Field label="Version" value={service.version} mono />
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
                    Description
                </span>
                <div className="bg-muted/50 rounded-md px-3 py-2.5 border text-sm leading-relaxed text-foreground break-all">
                    {service.description}
                </div>
            </div>

            <div>
                <SectionCard
                    icon={<BuildingIcon className="size-3.5 text-muted-foreground" />}
                    title="Organization"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Name" value={service.organization?.name} />
                        <Field label="Internal URL" value={service.organization?.url} isLink />
                    </div>
                </SectionCard>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <SectionCard
                    icon={<StarIcon className="size-3.5 text-muted-foreground" />}
                    title="Type Spec"
                >
                    <div className="flex flex-col gap-3">
                        <Field label="Artifact" value={service.type?.artifact} mono />
                        <Field label="Group" value={service.type?.group} mono />
                        <Field label="Version" value={service.type?.version} mono />
                    </div>
                </SectionCard>
                <SectionCard
                    icon={<ClockIcon className="size-3.5 text-muted-foreground" />}
                    title="Endpoint"
                >
                    <div className="flex flex-col gap-3">
                        <Field label="Deploy Version" value={service.version} mono />
                        <Field label="Source URL" value={service.url} isLink />
                    </div>
                </SectionCard>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
                        Raw Metadata
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2.5"
                        onClick={handleCopyJson}
                    >
                        Copy JSON
                    </Button>
                </div>
                <pre className="bg-[#1e1e1e] text-[#9cdcfe] text-[11px] leading-relaxed font-mono rounded-md p-4 overflow-x-auto">
                    {JSON.stringify(service, null, 2)}
                </pre>
            </div>
        </div>
    );
}

export default ViewServiceDialogBody;
