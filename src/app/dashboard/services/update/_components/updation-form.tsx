"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useForm } from "@tanstack/react-form";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { useCloudRegistry } from "@/hooks";
import type { Verification } from "@/lib/cloud-registry.types";
import { duplicateToast, isDuplicate, mutationError } from "@/lib/errors";
import { matchesVerification } from "@/lib/verifications";
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
    verification?: Verification;
    disabled?: boolean;
    onServiceUpdated?: (service: ExternalService) => void;
};

function ServiceUpdationForm({
    service,
    verification,
    disabled,
    onServiceUpdated,
}: Props) {
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

            const data = normalizeServiceData(value, service);
            const promise = cloudRegistryProvider.updateService(
                service.id,
                data,
            );
            toast.promise(promise, {
                loading: `Updating service with ID - ${service.id}`,
                success: (response) =>
                    `Successfully updated service with id - ${response}`,
                error: (err) =>
                    duplicateToast(err) ?? {
                        message: mutationError(
                            err,
                            "Cannot update service currently.",
                        ),
                    },
            });

            try {
                await promise;
                onServiceUpdated?.({ ...service, ...data });
            } catch (err) {
                // toast.promise shows the error; a duplicate is also shown
                // on the URL field, until a field changes or loses focus
                if (isDuplicate(err))
                    form.setFieldMeta("url", (prev) => ({
                        ...prev,
                        isTouched: true,
                        errorMap: {
                            ...prev.errorMap,
                            onServer: {
                                message:
                                    "A service with this URL and API type is already registered.",
                            },
                        },
                        errorSourceMap: {
                            ...prev.errorSourceMap,
                            onServer: "form",
                        },
                    }));
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
            <form.Subscribe selector={(state) => !state.isDefaultValue}>
                {(changed) => <UnsavedChangesGuard when={changed} />}
            </form.Subscribe>
            <fieldset
                disabled={updating || disabled}
                className="min-w-0 space-y-4"
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
                {verification && (
                    <form.Subscribe selector={(state) => state.values}>
                        {(values) =>
                            !matchesVerification(
                                normalizeServiceData(values),
                                verification,
                            ) && (
                                <p className="flex items-center gap-2 text-sm text-destructive">
                                    <TriangleAlertIcon className="size-4" />
                                    Changing the Service URL, Type Group or Type
                                    Artifact removes the verification of this
                                    service.
                                </p>
                            )
                        }
                    </form.Subscribe>
                )}
                <ServiceActionButton form={form} updating={updating} />
            </fieldset>
        </form>
    );
}

export default ServiceUpdationForm;
