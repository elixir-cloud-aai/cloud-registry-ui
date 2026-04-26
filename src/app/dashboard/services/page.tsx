"use client";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { useCloudRegistry } from "@/hooks";
import { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    ServicesTableBody,
    ServicesTableFooter,
    ServicesTableHeader,
    ServiceTableBodySkeleton,
} from "./_components";

function Page() {
    const router = useRouter();
    const { cloudRegistryProvider } = useCloudRegistry();
    const [services, setServices] = useState<ExternalService[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cloudRegistryProvider
            ?.getServices()
            .then((_val) => {
                setServices(_val);
            })
            .catch((err) => {})
            .finally(() => {
                setLoading(false);
            });
    }, [cloudRegistryProvider]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between w-full items-center">
                <div>
                    <h2 className="text-3xl font-semibold tracking-tight mt-2">Services</h2>
                    <p className="leading-7 mt-2">
                        Manage and monitor registered services across all envirnoments
                    </p>
                </div>
                <div className="hidden md:block space-x-2">
                    <Button
                        variant={"ghost"}
                        onClick={() => router.push("/dashboard/service-types")}
                    >
                        View Service Types
                    </Button>
                    <Button onClick={() => router.push("/dashboard/create-service")}>
                        <PlusIcon />
                        Register Service
                    </Button>
                </div>
            </div>
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
