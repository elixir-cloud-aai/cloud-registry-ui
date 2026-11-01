"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import {
    useCloudRegistry,
    useMe,
    useRegistrationRules,
    useServiceVerification,
} from "@/hooks";
import { getServiceWithApproval } from "@/lib/approvals";
import type { ServiceType } from "@/lib/cloud-registry.types";
import { errorMessage } from "@/lib/errors";
import { canEditService, isUnauthorized } from "@/lib/permissions";
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
    // the registry's rules for the entries; if they are unknown, the
    // registry checks the entries when they are sent
    const {
        rules,
        loading: rulesLoading,
        error: rulesError,
    } = useRegistrationRules();
    // the registered types to choose from, approved ones only (GET
    // /services/types lists no pending ones to requests without a user);
    // null if they couldn't be loaded
    const [serviceTypes, setServiceTypes] = useState<ServiceType[] | null>();

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
        if (!cloudRegistryProvider) return;
        let current = true;
        cloudRegistryProvider
            .getServiceTypes()
            .then((val) => {
                if (current) setServiceTypes(val);
            })
            .catch((err) => {
                // the form then offers the stored type, and new ones if
                // the user may add them
                console.error("Failed to load the service types:", err);
                if (current) setServiceTypes(null);
            });
        return () => {
            current = false;
        };
    }, [cloudRegistryProvider]);

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
        if (rulesError)
            toast.warning(
                "The registry's rules for registrations are unknown (it publishes none, or they couldn't be read): the registry checks the environment and the service URL when you submit.",
            );
    }, [rulesError]);

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

    if (loading || meLoading || rulesLoading || serviceTypes === undefined)
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
                    rules={rules}
                    verification={verification}
                    admin={me?.admin}
                    pending={pending}
                    typesPending={me?.service_types_pending}
                    serviceTypes={serviceTypes}
                    // as in the create form: without the registry's
                    // answer, the registry decides when the form is sent
                    mayAddServiceTypes={me?.may_add_service_types !== false}
                    disabled={refreshing}
                    onServiceUpdated={onServiceUpdated}
                    onServiceRenamed={onServiceRenamed}
                />
            )}{" "}
        </div>
    );
}

export default Page;
