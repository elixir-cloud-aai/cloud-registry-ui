"use client";
import { useCloudRegistry } from "@/hooks";
import { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ServiceUpdationForm } from "../_components";

function Page() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const { cloudRegistryProvider } = useCloudRegistry();
    const [service, setService] = useState<ExternalService>();

    useEffect(() => {
        if (!id) return;
        cloudRegistryProvider
            ?.getServiceById(id as string)
            .then((_val) => {
                setService(_val);
                console.log(_val);
            })
            .catch(() => toast.error("Cannot fetch the service details. Please try again later."))
            .finally(() => setLoading(false));
    }, [cloudRegistryProvider]);


    if(loading) 
        return (
            <div className="w-full flex justify-center items-center h-full">
                <p>Loading...</p>
            </div>
        )

    if(loading === false && !service) 
        return (
            <div className="w-full flex justify-center items-center h-full">
                <p>No service data found. Please try again later.</p>
            </div>
        )

    return (
        <div className="max-w-5xl mx-auto mt-8">
            {service && <ServiceUpdationForm service={service} />}{" "}
        </div>
    );
}

export default Page;
