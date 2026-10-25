import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { Trash2Icon } from "lucide-react";
import { ApproveTypeButton } from "@/components/shared/approve-type";
import { PendingBadge } from "@/components/shared/pending";
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
import {
    Card,
    CardAction,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { typeLabel } from "@/lib/service-types";

type Props = {
    serviceType: ServiceType;
    pending?: boolean;
    canApprove: boolean;
    disabled?: boolean;
    provider: AuthenticatedCloudRegistryProvider | null;
    onRemove?: () => void;
    onApproved?: () => void;
};

function ServiceTypeCard({
    serviceType,
    pending = false,
    canApprove,
    disabled = false,
    provider,
    onRemove,
    onApproved,
}: Props) {
    const label = typeLabel(serviceType);

    return (
        <Card className="min-w-72">
            <CardHeader>
                <CardTitle className="break-all">{label}</CardTitle>
                {onRemove && (
                    <CardAction>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant={"ghost"}
                                    size={"icon-sm"}
                                    disabled={disabled}
                                    aria-label={`Remove ${label}`}
                                >
                                    <Trash2Icon />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        Remove service type?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Services can no longer be registered
                                        with {label}, unless it is added again.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        variant={"destructive"}
                                        disabled={disabled}
                                        onClick={onRemove}
                                    >
                                        Remove
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardAction>
                )}
            </CardHeader>
            {pending && (
                <CardFooter className="justify-between gap-2">
                    <PendingBadge />
                    {canApprove && (
                        <ApproveTypeButton
                            serviceType={serviceType}
                            provider={provider}
                            disabled={disabled}
                            onApproved={onApproved}
                        />
                    )}
                </CardFooter>
            )}
        </Card>
    );
}

export default ServiceTypeCard;
