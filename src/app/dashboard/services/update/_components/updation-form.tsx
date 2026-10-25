"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { useCloudRegistry } from "@/hooks";
import { mutationError } from "@/lib/errors";
import { TextareaField } from "./_fields/textarea-field";
import {
    ServiceActionButton,
    ServiceBasicInfoSection,
    ServiceContactInfoSection,
    ServiceEnvSection,
    ServiceTypeSection,
} from "./_sections";
import {
    formDataSchema,
    normalizeFormData,
    normalizeServiceData,
} from "./form-helper";

type Props = {
    service: ExternalService;
};

function ServiceUpdationForm({ service }: Props) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [updating, setUpdating] = useState(false);
    const form = useForm({
        defaultValues: normalizeFormData(service),
        validators: {
            onSubmit: formDataSchema,
        },
        onSubmit: async ({ value }) => {
            if (!cloudRegistryProvider) return;

            setUpdating(true);

            const promise = cloudRegistryProvider.updateService(
                service.id,
                normalizeServiceData(value, service),
            );
            toast.promise(promise, {
                loading: `Updating service with ID - ${service.id}`,
                success: (response) =>
                    `Successfully updated service with id - ${response}`,
                error: (err) =>
                    mutationError(err, "Cannot update service currently."),
            });

            try {
                await promise;
            } catch {
                // toast.promise shows the error
            } finally {
                setUpdating(false);
            }
        },
    });

    return (
        <form
            id="service-updation-form"
            className="space-y-4"
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
        >
            <ServiceBasicInfoSection form={form} />
            <ServiceTypeSection form={form} />
            <ServiceEnvSection form={form} />
            <TextareaField
                form={form}
                name="description"
                label="Description"
                placeholder="Provide a detailed description of what your service does"
            />
            <ServiceContactInfoSection form={form} />
            <ServiceActionButton form={form} updating={updating} />
        </form>
    );
}

export default ServiceUpdationForm;
