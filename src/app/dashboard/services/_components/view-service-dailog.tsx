"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import type { Me } from "@/lib/cloud-registry.types";
import { mutationError } from "@/lib/errors";
import { canDeleteService, canEditService } from "@/lib/permissions";
import ViewServiceDialogBody from "./view-service-dailog-body";

type Props = {
    service: ExternalService | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fetchServices: () => void;
    cloudRegistryProvider: AuthenticatedCloudRegistryProvider | null;
    me: Me | null;
};

function ServiceDetailsDialog({
    service,
    open,
    onOpenChange,
    fetchServices,
    cloudRegistryProvider,
    me,
}: Props) {
    const [isDeleting, setIsDeleting] = useState(false);

    if (!service) return null;

    const canEdit = canEditService(me, service.id);
    const canDelete = canDeleteService(me, service.id);

    const handleServiceDelete = async () => {
        if (!cloudRegistryProvider) return;
        setIsDeleting(true);

        const promise = cloudRegistryProvider.deleteService(service.id);

        toast.promise(promise, {
            loading: `Deleting service with ID - ${service.id}`,
            success: (response) => `Deleted service with ID - ${response}`,
            error: (err) =>
                mutationError(err, "Cannot delete service currently."),
        });

        try {
            await promise;
            fetchServices();
            onOpenChange(false);
        } catch {
            // toast.promise shows the error
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-4 py-4 border-b">
                    <DialogTitle className="text-lg font-bold">
                        Artifact Details
                    </DialogTitle>
                    <DialogDescription>
                        Complete metadata for {service.id} deployment.
                    </DialogDescription>
                </DialogHeader>

                <ViewServiceDialogBody service={service} />

                {(canEdit || canDelete) && (
                    <DialogFooter className="px-4 py-4 border-t">
                        {canEdit && (
                            <Button size="sm" asChild>
                                <Link
                                    href={`/dashboard/services/update/${encodeURIComponent(service.id)}`}
                                >
                                    Edit
                                </Link>
                            </Button>
                        )}
                        {canDelete && (
                            <Button
                                size="sm"
                                variant={"destructive"}
                                onClick={handleServiceDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </Button>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default ServiceDetailsDialog;
