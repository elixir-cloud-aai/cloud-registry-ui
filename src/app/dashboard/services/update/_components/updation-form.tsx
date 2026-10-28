"use client";
import type {
    ExternalService,
    ExternalServiceRegister,
} from "@elixir-cloud/cloud-registry/providers";
import { useForm } from "@tanstack/react-form";
import { ClockIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";
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
    renameError,
} from "@/lib/errors";
import { typeKey } from "@/lib/service-types";
import { matchesVerification } from "@/lib/verifications";
import { ReadOnlyField, TextField } from "./_fields";
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
    type FormData,
    formFields,
    hasServiceChanges,
    normalizeFormData,
    normalizeServiceData,
    serviceFormSchema,
} from "./form-helper";
import ServiceRenameDialog from "./rename-dialog";

type Props = {
    service: ExternalService;
    verification?: Verification;
    admin?: boolean;
    pending?: boolean;
    typesPending?: boolean;
    approvedTypes?: Set<string>;
    disabled?: boolean;
    onServiceUpdated?: (service: ExternalService) => void;
    onServiceRenamed?: (id: string) => void;
};

function ServiceUpdationForm({
    service,
    verification,
    admin = false,
    pending,
    typesPending = false,
    approvedTypes,
    disabled,
    onServiceUpdated,
    onServiceRenamed,
}: Props) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [updating, setUpdating] = useState(false);
    // the values to save once the new ID is confirmed
    const [renaming, setRenaming] = useState<FormData>();
    const initial = normalizeFormData(service, admin);
    const schema = useMemo(
        () =>
            serviceFormSchema(service.id, cloudRegistryProvider?.servicesPath),
        [service.id, cloudRegistryProvider],
    );

    // shown on the field until a field changes or loses focus
    const showFieldError = (
        field: (typeof formFields)[number],
        message: string,
    ) =>
        form.setFieldMeta(field, (prev) => ({
            ...prev,
            isTouched: true,
            errorMap: {
                ...prev.errorMap,
                onServer: { message },
            },
            errorSourceMap: {
                ...prev.errorSourceMap,
                onServer: "form",
            },
        }));

    // the saved data, or undefined if the update failed
    const updateService = async (value: FormData) => {
        if (!cloudRegistryProvider) return undefined;

        const data = normalizeServiceData(value, initial);
        const promise = cloudRegistryProvider.updateService(service.id, data);
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
            return data;
        } catch (err) {
            // toast.promise shows the error; a duplicate or a field the
            // registry rejected is also shown on the field
            const duplicate = isDuplicate(err);
            const field = duplicate ? "url" : errorField(err, formFields);
            if (field)
                showFieldError(
                    field,
                    duplicate ? duplicateMessage : errorMessage(err, ""),
                );
            return undefined;
        }
    };

    // the saved data of other changes, if any: then the page shows them
    // also if the rename fails
    const renameService = async (
        newId: string,
        saved?: ExternalServiceRegister,
    ) => {
        if (!cloudRegistryProvider) return;

        const promise = cloudRegistryProvider.renameService(service.id, newId);
        toast.promise(promise, {
            loading: `Changing the ID of service ${service.id} to ${newId}`,
            success: `Changed the ID of service ${service.id} to ${newId}`,
            error: (err) =>
                saved
                    ? `Saved the other changes, but cannot change the ID: ${renameError(err)}`
                    : renameError(err),
        });

        try {
            await promise;
            onServiceRenamed?.(newId);
        } catch (err) {
            if (saved) onServiceUpdated?.({ ...service, ...saved });
            else showFieldError("id", renameError(err));
        }
    };

    const saveService = async (value: FormData) => {
        setUpdating(true);
        try {
            const renamed = value.id !== service.id;
            if (renamed && !hasServiceChanges(value, initial))
                return await renameService(value.id);
            const saved = await updateService(value);
            // nothing is renamed if the update fails
            if (!saved) return;
            if (renamed) await renameService(value.id, saved);
            else onServiceUpdated?.({ ...service, ...saved });
        } finally {
            setUpdating(false);
        }
    };

    const form = useForm({
        defaultValues: initial,
        validators: {
            onChange: schema,
        },
        onSubmit: async ({ value }) => {
            if (value.id !== service.id) setRenaming(value);
            else await saveService(value);
        },
    });

    const handleRenameConfirm = () => {
        const value = renaming;
        setRenaming(undefined);
        if (value) saveService(value);
    };

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
                {admin ? (
                    <TextField
                        form={form}
                        name="id"
                        label="Service ID"
                        description="Changing the ID moves the service, with its roles and verification, to the new ID; links to the old ID stop working."
                    />
                ) : (
                    <ReadOnlyField
                        id="serviceId"
                        label="Service ID"
                        value={service.id}
                        description="Only admins can change the ID."
                    />
                )}
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
                            // approved types, if known, stay approved
                            typeKey(type) !== typeKey(initial.type) &&
                            !approvedTypes?.has(
                                typeKey({
                                    group: type.group.trim(),
                                    artifact: type.artifact.trim(),
                                    version: type.version.trim(),
                                }),
                            ) && (
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
            <ServiceRenameDialog
                oldId={service.id}
                newId={renaming?.id}
                onConfirm={handleRenameConfirm}
                onCancel={() => setRenaming(undefined)}
            />
        </form>
    );
}

export default ServiceUpdationForm;
