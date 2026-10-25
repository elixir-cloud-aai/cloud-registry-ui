"use client";
import { useForm } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/app/dashboard/services/update/_components/_fields";
import { serviceTypeSchema } from "@/app/dashboard/services/update/_components/form-helper";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { mutationError } from "@/lib/errors";
import { defaultType, typeLabel } from "./type-helper";

type Props = {
    provider: AuthenticatedCloudRegistryProvider | null;
    onAdded?: () => void;
};

function ServiceTypeAddDialog({ provider, onAdded }: Props) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        defaultValues: defaultType,
        validators: {
            onChange: serviceTypeSchema,
        },
        onSubmit: async ({ value }) => {
            if (!provider) return;
            const serviceType = serviceTypeSchema.parse(value);
            const promise = provider.addServiceType(serviceType);
            toast.promise(promise, {
                loading: `Adding service type ${typeLabel(serviceType)}`,
                success: `Added service type ${typeLabel(serviceType)}`,
                error: (err) =>
                    mutationError(
                        err,
                        "Cannot add the service type currently.",
                        "Only admins can add service types.",
                    ),
            });
            try {
                await promise;
                form.reset();
                setOpen(false);
                onAdded?.();
            } catch {
                // toast.promise shows the error
            }
        },
    });

    return (
        <Dialog
            open={open}
            onOpenChange={(val) => {
                if (!form.state.isSubmitting) setOpen(val);
            }}
        >
            <DialogTrigger asChild>
                <Button>
                    <PlusIcon />
                    Add service type
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                        Add service type
                    </DialogTitle>
                    <DialogDescription>
                        Services can then be registered with this type.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit();
                    }}
                >
                    <TextField
                        form={form}
                        name="group"
                        label="Type Group"
                        placeholder="org.ga4gh"
                    />
                    <TextField
                        form={form}
                        name="artifact"
                        label="Type Artifact"
                        placeholder="beacon, wes, trs, etc."
                    />
                    <TextField
                        form={form}
                        name="version"
                        label="Type Version"
                        placeholder="1.0.0"
                    />
                    <div className="flex justify-end">
                        <form.Subscribe
                            selector={(state) => state.isSubmitting}
                        >
                            {(isSubmitting) => (
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Adding..." : "Add"}
                                </Button>
                            )}
                        </form.Subscribe>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default ServiceTypeAddDialog;
