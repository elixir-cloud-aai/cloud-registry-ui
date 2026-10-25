"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { useCloudRegistry, useMe } from "@/hooks";
import { canEditService, isUnauthorized } from "@/lib/permissions";
import { ServiceUpdationForm } from "../_components";

function Page() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [service, setService] = useState<ExternalService>();
    const { me, loading: meLoading } = useMe();
    const [loginRequired, setLoginRequired] = useState(false);

    useEffect(() => {
        if (!id) return;
        cloudRegistryProvider
            ?.getServiceById(id as string)
            .then((_val) => {
                setService(_val);
                console.log(_val);
            })
            .catch((err) => {
                if (isUnauthorized(err)) setLoginRequired(true);
                else
                    toast.error(
                        "Cannot fetch the service details. Please try again later.",
                    );
            })
            .finally(() => setLoading(false));
    }, [cloudRegistryProvider, id]);

    if ((cloudRegistryProvider && !isLoggedIn) || loginRequired)
        return <LoginPrompt message="Log in to edit this service" />;

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
