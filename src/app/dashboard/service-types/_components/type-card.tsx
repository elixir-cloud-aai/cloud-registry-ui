import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { Trash2Icon } from "lucide-react";
import { Fragment } from "react";
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
import { breakParts, typeFields } from "./type-helper";

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
    // one string for the accessible names and the dialog
    const label = typeLabel(serviceType);

    return (
        <Card className="w-72 max-w-full">
            <CardHeader>
                <CardTitle>
                    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1">
                        {typeFields(serviceType).map(
                            ({ label: field, value }) => (
                                <div key={field} className="contents">
                                    <dt className="font-normal text-muted-foreground">
                                        {field}:
                                    </dt>
                                    {/* breaks after separators, e.g. "org.", and
                                    inside parts only if they don't fit */}
                                    <dd className="wrap-break-word">
                                        {breakParts(value).map(
                                            (part, index) => (
                                                // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one value, in a fixed order
                                                <Fragment key={index}>
                                                    {part}
                                                    <wbr />
                                                </Fragment>
                                            ),
                                        )}
                                    </dd>
                                </div>
                            ),
                        )}
                    </dl>
                </CardTitle>
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
