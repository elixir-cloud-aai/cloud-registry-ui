"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import type { Me, ServiceVerification } from "@/lib/cloud-registry.types";
import ServiceDetails from "./service-details";

type Props = {
    service: ExternalService | null;
    verification?: ServiceVerification;
    pending?: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fetchServices: () => void;
    // after a change of access, which may change the user's own roles
    refetchMe: () => void;
    cloudRegistryProvider: AuthenticatedCloudRegistryProvider | null;
    me: Me | null;
};

function ServiceDetailsDialog({
    service,
    verification,
    pending = false,
    open,
    onOpenChange,
    fetchServices,
    refetchMe,
    cloudRegistryProvider,
    me,
}: Props) {
    if (!service) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* scrolls if the details are taller than the viewport */}
            <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] overflow-y-auto">
                <ServiceDetails
                    service={service}
                    verification={verification}
                    pending={pending}
                    cloudRegistryProvider={cloudRegistryProvider}
                    me={me}
                    Title={DialogTitle}
                    Description={DialogDescription}
                    onChange={fetchServices}
                    onAccessChange={() => {
                        fetchServices();
                        refetchMe();
                    }}
                    onDeleted={() => {
                        fetchServices();
                        onOpenChange(false);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

export default ServiceDetailsDialog;
