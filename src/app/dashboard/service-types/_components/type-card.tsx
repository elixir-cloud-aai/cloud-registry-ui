import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { Trash2Icon } from "lucide-react";
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
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { typeLabel } from "./type-helper";

type Props = {
    serviceType: ServiceType;
    disabled?: boolean;
    onRemove?: () => void;
};

function ServiceTypeCard({ serviceType, disabled = false, onRemove }: Props) {
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
        </Card>
    );
}

export default ServiceTypeCard;
