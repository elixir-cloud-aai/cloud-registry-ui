"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { useCloudRegistry, useMe, useServiceVerification } from "@/hooks";
import { getServiceWithApproval } from "@/lib/approvals";
import { errorMessage } from "@/lib/errors";
import { canEditService, isUnauthorized } from "@/lib/permissions";
import { ServiceUpdationForm } from "../_components";

function Page() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [service, setService] = useState<ExternalService>();
    // undefined if unknown, see getServiceWithApproval
    const [pending, setPending] = useState<boolean>();
    const verification = useServiceVerification(service);
    const { me, loading: meLoading, error: meError, expired } = useMe();
    const [loginRequired, setLoginRequired] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

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

    useEffect(() => {
        fetchService();
    }, [fetchService]);

    // the saved values are the form's new defaults; the form stays disabled
    // until the registry's version replaces them
    const onServiceUpdated = (saved: ExternalService) => {
        setService(saved);
        setRefreshing(true);
        Promise.resolve(fetchService()).finally(() => setRefreshing(false));
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
                    disabled={refreshing}
                    onServiceUpdated={onServiceUpdated}
                />
            )}{" "}
        </div>
    );
}

export default Page;
