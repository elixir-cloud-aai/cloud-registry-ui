"use client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import ViewServiceDialogBody from "./view-service-dailog-body";

type Props = {
    service: ExternalService | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fetchServices: () => void;
    cloudRegistryProvider: AuthenticatedCloudRegistryProvider | null;
};

function ServiceDetailsDialog({
    service,
    open,
    onOpenChange,
    fetchServices,
    cloudRegistryProvider,
}: Props) {
    if (!service) return null;

    const [isDeleting, setIsDeleting] = useState(false);

    const handleServiceDelete = async () => {
        if (!cloudRegistryProvider) return;
        setIsDeleting(true);

        const promise = cloudRegistryProvider.deleteService(service.id);

        toast.promise(promise, {
            loading: `Deleting service with ID - ${service.id}`,
            success: (response) => `Deleted service with ID - ${response}`,
            error: "Cannot delete service currently.",
        });

        try {
            await promise;
            fetchServices();
            onOpenChange(false);
        } catch {
            toast.error("Cannot update the service list.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-4 py-4 border-b">
                    <DialogTitle className="text-lg font-bold">Artifact Details</DialogTitle>
                    <DialogDescription>
                        Complete metadata for {service.id} deployment.
                    </DialogDescription>
                </DialogHeader>

                <ViewServiceDialogBody service={service} />

                <DialogFooter className="px-4 py-4 border-t">
                    <Button size="sm" asChild>
                        <Link href={`/dashboard/update-service/${service.id}`}>
                        
                        Edit
                        </Link>
                    </Button>
                    <Button
                        size="sm"
                        variant={"destructive"}
                        onClick={handleServiceDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default ServiceDetailsDialog;
