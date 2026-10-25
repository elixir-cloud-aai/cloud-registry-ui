"use client";
import type { Service } from "@elixir-cloud/cloud-registry/providers";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { useCloudRegistry } from "@/hooks";
import { errorMessage } from "@/lib/errors";
import {
    CardSkeleton,
    ServiceInfoCardContent,
    ServiceInfoCardHeader,
} from "./_components";

function Page() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [serviceInfo, setServiceInfo] = useState<Service>();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchServiceInfo = useCallback(() => {
        cloudRegistryProvider
            ?.getServiceInfo()
            .then((data) => setServiceInfo(data))
            .catch((err) => {
                toast.error(
                    errorMessage(err, "Could not fetch the service info."),
                );
                setError(true);
            })
            .finally(() => setLoading(false));
    }, [cloudRegistryProvider]);

    useEffect(() => {
        fetchServiceInfo();
    }, [fetchServiceInfo]);

    if (loading) return <CardSkeleton />;

    if (error)
        return (
            <div className="w-full h-full overflow-hidden">
                <p className="align-middle text-muted-foreground">
                    Could not fetch the service info
                </p>
            </div>
        );

    return (
        <Card className="w-full max-w-4xl mx-auto mt-4 md:mt-10">
            <ServiceInfoCardHeader serviceInfo={serviceInfo} />
            <ServiceInfoCardContent serviceInfo={serviceInfo} />
        </Card>
    );
}

export default Page;
