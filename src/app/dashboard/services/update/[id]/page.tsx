"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { useCloudRegistry, useMe, useServiceVerification } from "@/hooks";
import { getServiceWithApproval } from "@/lib/approvals";
import { errorMessage } from "@/lib/errors";
import { canEditService, isUnauthorized } from "@/lib/permissions";
import { typeKey } from "@/lib/service-types";
import { ServiceUpdationForm } from "../_components";

function Page() {
    const { id } = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [service, setService] = useState<ExternalService>();
    // undefined if unknown, see getServiceWithApproval
    const [pending, setPending] = useState<boolean>();
    const { verification } = useServiceVerification(service);
    const { me, loading: meLoading, error: meError, expired } = useMe();
    const [loginRequired, setLoginRequired] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    // the approved types (GET /services/types lists no pending ones to
    // requests without a user), for the form's note on new types
    const [approvedTypes, setApprovedTypes] = useState<Set<string>>();

    // pending services are only listed in GET /approvals, e.g. after a
    // change to a pending type
    const fetchService = useCallback(() => {
        if (!id || !cloudRegistryProvider) return;
        return getServiceWithApproval(
            cloudRegistryProvider,
            decodeURIComponent(id as string),
        )
            .then((_val) => {
                setService(_val.service);
                setPending(_val.pending);
                if (_val.pending === undefined)
                    toast.error(
                        "Could not check whether this service awaits approval. Please try again later.",
                    );
            })
            .catch((err) => {
                if (isUnauthorized(err)) setLoginRequired(true);
                else
                    toast.error(
                        errorMessage(
                            err,
                            "Cannot fetch the service details. Please try again later.",
                        ),
                    );
            })
            .finally(() => setLoading(false));
    }, [cloudRegistryProvider, id]);

    // the form stays disabled until the service is loaded again
    const refetchService = useCallback(
        () =>
            Promise.resolve(fetchService()).finally(() => setRefreshing(false)),
        [fetchService],
    );

    // also after a rename, which changes the ID
    useEffect(() => {
        refetchService();
    }, [refetchService]);

    useEffect(() => {
        if (!cloudRegistryProvider || !me?.service_types_pending) return;
        let current = true;
        cloudRegistryProvider
            .getServiceTypes()
            .then((val) => {
                if (current) setApprovedTypes(new Set(val.map(typeKey)));
            })
            .catch((err) => {
                // the note then shows for every change of the type
                console.error("Failed to load the service types:", err);
            });
        return () => {
            current = false;
        };
    }, [cloudRegistryProvider, me?.service_types_pending]);

    // the saved values are the form's new defaults; the form stays disabled
    // until the registry's version replaces them
    const onServiceUpdated = (saved: ExternalService) => {
        setService(saved);
        setRefreshing(true);
        refetchService();
    };

    // the old ID is gone: the page of the new one replaces it in the history
    const onServiceRenamed = (newId: string) => {
        setRefreshing(true);
        router.replace(
            `/dashboard/services/update/${encodeURIComponent(newId)}`,
        );
    };

    useEffect(() => {
        if (meError && !expired)
            toast.error(
                "Could not check your permissions. Please try again later.",
            );
    }, [meError, expired]);

    if (cloudRegistryProvider && !isLoggedIn)
        return <LoginPrompt message="Log in to edit this service" />;

    if (loginRequired || expired)
        return (
            <LoginPrompt message="Your session expired. Please log in again." />
        );

    if (loading || meLoading)
        return (
            <div className="w-full flex justify-center items-center h-full">
                <p>Loading...</p>
            </div>
        );

    if (loading === false && !service)
        return (
            <div className="w-full flex justify-center items-center h-full">
                <p>No service data found. Please try again later.</p>
            </div>
        );

    if (me && service && !canEditService(me, service.id))
        return (
            <div className="w-full flex justify-center items-center h-full">
                <p>You don't have permission to change this service.</p>
            </div>
        );

    return (
        <div className="max-w-5xl mx-auto mt-8">
            {service && (
                <ServiceUpdationForm
                    // a new form for the saved service, so it has no changes
                    key={JSON.stringify(service)}
                    service={service}
                    verification={verification}
                    admin={me?.admin}
                    pending={pending}
                    typesPending={me?.service_types_pending}
                    approvedTypes={approvedTypes}
                    disabled={refreshing}
                    onServiceUpdated={onServiceUpdated}
                    onServiceRenamed={onServiceRenamed}
                />
            )}{" "}
        </div>
    );
}

export default Page;
