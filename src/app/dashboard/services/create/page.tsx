"use client";
import type {
    EccServiceCreatedEvent,
    EccServiceCreateFailedEvent,
    EccServiceCreateValidationFailedEvent,
} from "@elixir-cloud/cloud-registry/events";
import type { ExternalServiceRegister } from "@elixir-cloud/cloud-registry/providers";
import { ECCClientElixirCloudRegistryServiceCreate } from "@elixir-cloud/cloud-registry/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { useCloudRegistry, useFormChanged, useMe } from "@/hooks";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { duplicateToast, withFieldLabels } from "@/lib/errors";
import {
    environmentMessage,
    isAllowedEnvironment,
} from "@/lib/service-environments";

function Page() {
    const router = useRouter();
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const { me, loading, error, expired } = useMe();
    const createError = useRef<unknown>(null);
    const { changed, setChanged, watchForm } = useFormChanged();

    useEffect(() => {
        if (error && !expired)
            toast.error(
                "Could not check your permissions. Please try again later.",
            );
    }, [error, expired]);

    // cloud-components gap: the create component passes on only the error
    // message, so the provider keeps the error, e.g. for the duplicate's ID
    const provider = useMemo(() => {
        if (cloudRegistryProvider === null) return null;

        // cloud-components gap (cloud-components#461): the create component
        // offers the default environments only, so others get an error
        // before the request
        const checkEnvironment = (
            service: ExternalServiceRegister,
            request: () => Promise<string>,
        ) =>
            isAllowedEnvironment(service.environment)
                ? request()
                : Promise.reject(new Error(environmentMessage));

        const keepError = (promise: Promise<string>) => {
            createError.current = null;
            return promise.catch((err) => {
                createError.current = err;
                throw err;
            });
        };

        return Object.assign(Object.create(cloudRegistryProvider), {
            createService: (service: ExternalServiceRegister) =>
                keepError(
                    checkEnvironment(service, () =>
                        cloudRegistryProvider.createService(service),
                    ),
                ),
            // cloud-components gap: the create component can't hide the
            // custom ID field, so non-admins get an error before the request
            createServiceWithId: (
                id: string,
                service: ExternalServiceRegister,
            ) =>
                keepError(
                    me?.admin
                        ? checkEnvironment(service, () =>
                              cloudRegistryProvider.createServiceWithId(
                                  id,
                                  service,
                              ),
                          )
                        : Promise.reject(
                              new Error(
                                  "Only admins can choose identifiers; leave the field empty.",
                              ),
                          ),
                ),
        }) as AuthenticatedCloudRegistryProvider;
    }, [cloudRegistryProvider, me]);

    const onServiceCreated = (e: EccServiceCreatedEvent) => {
        const { serviceId, serviceData } = e.detail;
        setChanged(false);
        toast.success(`Registered ${serviceData.name} with ID - ${serviceId}`, {
            action: {
                label: "View service",
                onClick: () =>
                    router.push(
                        `/dashboard/services/view/${encodeURIComponent(serviceId)}`,
                    ),
            },
            duration: 10000,
        });
        router.replace("/dashboard/services");
    };

    const onServiceCreationFailed = (e: EccServiceCreateFailedEvent) => {
        const err = createError.current;
        createError.current = null;

        const duplicate =
            err instanceof Error && err.message === e.detail.error
                ? duplicateToast(err)
                : null;
        if (duplicate) {
            const { message, ...data } = duplicate;
            toast.error(message, data);
            return;
        }

        toast.error(withFieldLabels(e.detail.error));
    };

    const onValidationError = (e: EccServiceCreateValidationFailedEvent) => {
        toast.error(e.detail.error);
    };

    if (provider === null) return;

    if (!isLoggedIn)
        return <LoginPrompt message="Log in to register a service" />;

    if (expired)
        return (
            <LoginPrompt message="Your session expired. Please log in again." />
        );

    // cloud-components gap: the create component ignores later provider
    // changes, so it renders only once the admin flag is known
    if (loading)
        return (
            <p className="font-bold text-lg mt-20 text-center w-full">
                Loading...
            </p>
        );

    return (
        <div ref={watchForm} className="max-w-5xl mx-auto mt-5 md:mt-8">
            <UnsavedChangesGuard when={changed} />
            <ECCClientElixirCloudRegistryServiceCreate
                onEccServiceCreated={onServiceCreated}
                onEccServiceCreateFailed={onServiceCreationFailed}
                onEccServiceCreateValidationFailed={onValidationError}
                provider={provider}
            />
        </div>
    );
}

export default Page;
