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
import type { Me, ServiceVerification } from "@/lib/cloud-registry.types";
import { mutationError } from "@/lib/errors";
import {
    canDeleteService,
    canEditService,
    canVerifyService,
    hasStatus,
} from "@/lib/permissions";
import VerifiedBadge from "./verified-badge";
import ViewServiceDialogBody from "./view-service-dailog-body";

type Props = {
    service: ExternalService | null;
    verification?: ServiceVerification;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fetchServices: () => void;
    cloudRegistryProvider: AuthenticatedCloudRegistryProvider | null;
    me: Me | null;
};

function ServiceDetailsDialog({
    service,
    verification,
    open,
    onOpenChange,
    fetchServices,
    cloudRegistryProvider,
    me,
}: Props) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    if (!service) return null;

    const canEdit = canEditService(me, service.id);
    const canDelete = canDeleteService(me, service.id);
    const canVerify = canVerifyService(me);

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

    const handleServiceVerify = async () => {
        if (!cloudRegistryProvider) return;
        setIsVerifying(true);

        const removing = !!verification;
        const promise = removing
            ? cloudRegistryProvider.removeServiceVerification(service.id)
            : cloudRegistryProvider.verifyService(service.id, {
                  url: service.url,
                  type: service.type,
              });

        toast.promise(promise, {
            loading: removing
                ? `Removing verification of service with ID - ${service.id}`
                : `Verifying service with ID - ${service.id}`,
            success: removing
                ? `Removed verification of service with ID - ${service.id}`
                : `Verified service with ID - ${service.id}`,
            error: (err) =>
                hasStatus(err, 409)
                    ? "The service changed after it was checked. Please check it again."
                    : mutationError(
                          err,
                          removing
                              ? "Cannot remove the verification currently."
                              : "Cannot verify service currently.",
                      ),
        });

        try {
            await promise;
        } catch {
            // toast.promise shows the error
        } finally {
            fetchServices();
            setIsVerifying(false);
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
                    {verification && <VerifiedBadge />}
                </DialogHeader>

                <ViewServiceDialogBody
                    service={service}
                    verification={verification}
                />

                {(canEdit || canDelete || canVerify) && (
                    <DialogFooter className="px-4 py-4 border-t">
                        {canVerify && (
                            <Button
                                size="sm"
                                variant={"outline"}
                                onClick={handleServiceVerify}
                                disabled={isVerifying}
                            >
                                {verification ? "Unverify" : "Verify"}
                            </Button>
                        )}
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
