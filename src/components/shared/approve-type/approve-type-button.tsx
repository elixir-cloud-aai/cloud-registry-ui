"use client";
import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { mutationError } from "@/lib/errors";
import { typeLabel } from "@/lib/service-types";

type Props = {
    serviceType: ServiceType;
    provider: AuthenticatedCloudRegistryProvider | null;
    disabled?: boolean;
    onApproved?: () => void;
};

function ApproveTypeButton({
    serviceType,
    provider,
    disabled = false,
    onApproved,
}: Props) {
    const [approving, setApproving] = useState(false);
    const label = typeLabel(serviceType);

    const handleApprove = async () => {
        if (!provider) return;
        setApproving(true);

        const promise = provider.approveServiceType(serviceType);

        toast.promise(promise, {
            loading: `Approving service type ${label}`,
            success: `Approved service type ${label}`,
            error: (err) =>
                mutationError(
                    err,
                    "Cannot approve the service type currently.",
                    "Only admins can approve service types.",
                ),
        });

        try {
            await promise;
            onApproved?.();
        } catch {
            // toast.promise shows the error
        } finally {
            setApproving(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    size="sm"
                    variant={"outline"}
                    disabled={disabled || approving}
                >
                    <CheckIcon />
                    Approve
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Approve service type?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {label} and all services that have it are then listed
                        for everyone. Approvals can't be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={disabled || approving}
                        onClick={handleApprove}
                    >
                        Approve
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default ApproveTypeButton;
