"use client";
import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCloudRegistry } from "@/hooks";

function Page() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [serviceTypes, setServiceTypes] = useState<ServiceType[] | null>(
        null,
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cloudRegistryProvider
            ?.getServiceTypes()
            .then((val) => setServiceTypes(val))
            .finally(() => setLoading(false));
    }, [cloudRegistryProvider]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-semibold tracking-tight mt-2">
                    Service Types
                </h2>
                <p className="leading-7 mt-2">
                    Manage and monitor registered service types across all
                    environments
                </p>
            </div>
            <div>
                <div className="flex gap-4 flex-wrap justify-center md:justify-start">
                    {loading === true && (
                        <p className="font-bold text-lg mt-20 text-center w-full">
                            Loading...
                        </p>
                    )}
                    {serviceTypes !== null &&
                        serviceTypes?.map((val, idx) => (
                            <div key={idx}>
                                <Card className="min-w-72 hover:scale-[102%] transition-all cursor-pointer">
                                    <CardHeader>
                                        <CardTitle>
                                            Artifact - {val.artifact}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <p>Group - {val.group}</p>
                                        <p>Version - {val.version}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    {loading === false && serviceTypes === null && (
                        <p className="font-bold text-lg mt-20 text-center w-full">
                            No service types
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Page;
