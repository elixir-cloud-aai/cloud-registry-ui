"use client";
import { Table } from "@/components/ui/table";
import { useCloudRegistry } from "@/hooks";
import { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useEffect, useState } from "react";
import {
    ServicesTableBody,
    ServicesTableFooter,
    ServicesTableHeader,
    ServiceTableBodySkeleton,
} from "./_components";

function Page() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [services, setServices] = useState<ExternalService[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cloudRegistryProvider
            ?.getServices()
            .then((_val) => {
                setServices(_val)
            })
            .catch((err) => {})
            .finally(() => {
                setLoading(false);
            });
    }, [cloudRegistryProvider]);

    return (
        <div>
            <div className="rounded-xl border overflow-hidden">
                <Table>
                    <ServicesTableHeader />
                    {loading === true ? (
                        <ServiceTableBodySkeleton />
                    ) : (
                        <ServicesTableBody services={services} />
                    )}
                    <ServicesTableFooter />
                </Table>
            </div>
        </div>
    );
}

export default Page;
