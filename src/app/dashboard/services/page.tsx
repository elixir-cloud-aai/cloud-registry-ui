"use client";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { useCloudRegistry } from "@/hooks";
import { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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

    const fetchServices = () => {
        cloudRegistryProvider
            ?.getServices()
            .then((_val) => {
                setServices(_val);
            })
            .catch((err) => {
                console.error("Failed to load services from cloud registry provider:", err);
                toast.error(
                    "We are having trouble loading services. Please refresh or try again later.",
                );
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchServices();
    }, [cloudRegistryProvider]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between w-full items-center">
                <div>
                    <h2 className="text-3xl font-semibold tracking-tight mt-2">Services</h2>
                    <p className="leading-7 mt-2">
                        Manage and monitor registered services across all environments
                    </p>
                </div>
                <div className="hidden md:flex flex-wrap gap-2 justify-end">
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
                        <ServicesTableBody services={services} fetchServices={fetchServices} />
                    )}
                    <ServicesTableFooter />
                </Table>
            </div>
        </div>
    );
}

export default Page;
