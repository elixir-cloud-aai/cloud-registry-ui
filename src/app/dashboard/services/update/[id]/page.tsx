"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { useCloudRegistry, useMe } from "@/hooks";
import { errorMessage } from "@/lib/errors";
import { canEditService, isUnauthorized } from "@/lib/permissions";
import { ServiceUpdationForm } from "../_components";

function Page() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [service, setService] = useState<ExternalService>();
    const { me, loading: meLoading, error: meError, expired } = useMe();
    const [loginRequired, setLoginRequired] = useState(false);

    useEffect(() => {
        if (!id) return;
        cloudRegistryProvider
            ?.getServiceById(decodeURIComponent(id as string))
            .then((_val) => {
                setService(_val);
                console.log(_val);
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
            {service && <ServiceUpdationForm service={service} />}{" "}
        </div>
    );
}

export default Page;
