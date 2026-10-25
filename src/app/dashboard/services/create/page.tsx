"use client";
import type {
    EccServiceCreatedEvent,
    EccServiceCreateFailedEvent,
    EccServiceCreateValidationFailedEvent,
} from "@elixir-cloud/cloud-registry/events";
import { ECCClientElixirCloudRegistryServiceCreate } from "@elixir-cloud/cloud-registry/react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useCloudRegistry, useMe } from "@/hooks";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";

function Page() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const { me, loading, error } = useMe();

    useEffect(() => {
        if (error)
            toast.error(
                "Could not check your permissions; if your session expired, log in again.",
            );
    }, [error]);

    // cloud-components gap: the create component can't hide the custom ID
    // field, so non-admins get an error before the request instead
    const provider = useMemo(() => {
        if (cloudRegistryProvider === null || me?.admin)
            return cloudRegistryProvider;

        return Object.assign(Object.create(cloudRegistryProvider), {
            createServiceWithId: () =>
                Promise.reject(
                    new Error(
                        "Only admins can choose identifiers; leave the field empty.",
                    ),
                ),
        }) as AuthenticatedCloudRegistryProvider;
    }, [cloudRegistryProvider, me]);

    const onServiceCreated = (e: EccServiceCreatedEvent) => {
        toast.success(e.detail.message);
    };

    const onServiceCreationFailed = (e: EccServiceCreateFailedEvent) => {
        toast.error(e.detail.error);
    };

    const onValidationError = (e: EccServiceCreateValidationFailedEvent) => {
        toast.error(e.detail.error);
    };

    if (provider === null) return;

    // cloud-components gap: the create component ignores later provider
    // changes, so it renders only once the admin flag is known
    if (loading)
        return (
            <p className="font-bold text-lg mt-20 text-center w-full">
                Loading...
            </p>
        );

    return (
        <div className="max-w-5xl mx-auto mt-5 md:mt-8">
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
