"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useForm } from "@tanstack/react-form";
import { ClockIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { useCloudRegistry } from "@/hooks";
import type { Verification } from "@/lib/cloud-registry.types";
import {
    duplicateMessage,
    duplicateToast,
    errorField,
    errorMessage,
    isDuplicate,
    mutationError,
} from "@/lib/errors";
import { typeKey } from "@/lib/service-types";
import { matchesVerification } from "@/lib/verifications";
import { ReadOnlyField } from "./_fields";
import { TextareaField } from "./_fields/textarea-field";
import {
    ServiceActionButton,
    ServiceAdvancedSection,
    ServiceBasicInfoSection,
    ServiceContactInfoSection,
    ServiceEnvSection,
    ServiceTypeSection,
} from "./_sections";
import {
    formDataSchema,
    formFields,
    normalizeFormData,
    normalizeServiceData,
} from "./form-helper";

type Props = {
    service: ExternalService;
    verification?: Verification;
    admin?: boolean;
    pending?: boolean;
    typesPending?: boolean;
    disabled?: boolean;
    onServiceUpdated?: (service: ExternalService) => void;
};

function ServiceUpdationForm({
    service,
    verification,
    admin = false,
    pending,
    typesPending = false,
    disabled,
    onServiceUpdated,
}: Props) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [updating, setUpdating] = useState(false);
    const initial = normalizeFormData(service, admin);
    const form = useForm({
        defaultValues: initial,
        validators: {
            onChange: formDataSchema,
        },
        onSubmit: async ({ value }) => {
            if (!cloudRegistryProvider) return;

            setUpdating(true);

            const data = normalizeServiceData(value, initial);
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
                // toast.promise shows the error; a duplicate or a field the
                // registry rejected is also shown on the field, until a
                // field changes or loses focus
                const duplicate = isDuplicate(err);
                const field = duplicate ? "url" : errorField(err, formFields);
                if (field)
                    form.setFieldMeta(field, (prev) => ({
                        ...prev,
                        isTouched: true,
                        errorMap: {
                            ...prev.errorMap,
                            onServer: {
                                message: duplicate
                                    ? duplicateMessage
                                    : errorMessage(err, ""),
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
                <ReadOnlyField
                    id="serviceId"
                    label="Service ID"
                    value={service.id}
                    description="The ID can't be changed."
                />
                <ServiceBasicInfoSection form={form} />
                <ServiceTypeSection form={form} />
                {pending && !admin && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ClockIcon className="size-4 shrink-0" />
                        This service awaits the approval of its service type by
                        an admin: until then, only a change to an approved type
                        can be saved.
                    </p>
                )}
                {typesPending && !pending && (
                    <form.Subscribe selector={(state) => state.values.type}>
                        {(type) =>
                            typeKey(type) !== typeKey(initial.type) && (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <ClockIcon className="size-4 shrink-0" />A
                                    service type that isn't registered yet is
                                    pending until an admin approves it, and so
                                    is this service: until then, it can only be
                                    changed to an approved type.
                                </p>
                            )
                        }
                    </form.Subscribe>
                )}
                <ServiceEnvSection form={form} />
                <ServiceContactInfoSection form={form} />
                <TextareaField
                    form={form}
                    name="description"
                    label="Description"
                    placeholder="Provide a detailed description of what your service does"
                />
                {admin && (
                    <ServiceAdvancedSection
                        form={form}
                        updatedAt={service.updatedAt}
                    />
                )}
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
