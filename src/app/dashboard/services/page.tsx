"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { LogIn, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { useCloudRegistry } from "@/hooks";
import { isUnauthorized } from "@/lib/permissions";
import {
    ServicesTableBody,
    ServicesTableFooter,
    ServicesTableHeader,
    ServiceTableBodySkeleton,
} from "./_components";

function Page() {
    const router = useRouter();
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [services, setServices] = useState<ExternalService[]>([]);
    const [loading, setLoading] = useState(true);
    const [loginRequired, setLoginRequired] = useState(false);

    const fetchServices = () => {
        cloudRegistryProvider
            ?.getServices()
            .then((_val) => {
                setServices(_val);
            })
            .catch((err) => {
                if (isUnauthorized(err)) {
                    setLoginRequired(true);
                    return;
                }
                console.error(
                    "Failed to load services from cloud registry provider:",
                    err,
                );
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
                    <h2 className="text-3xl font-semibold tracking-tight mt-2">
                        Services
                    </h2>
                    <p className="leading-7 mt-2">
                        Manage and monitor registered services across all
                        environments
                    </p>
                </div>
                <div className="hidden md:flex flex-wrap gap-2 justify-end">
                    {isLoggedIn ? (
                        <Button
                            onClick={() =>
                                router.push("/dashboard/services/create")
                            }
                        >
                            <PlusIcon />
                            Register Service
                        </Button>
                    ) : (
                        <Button variant={"outline"} asChild>
                            <Link href={"/auth/api/login-redirect"}>
                                <LogIn />
                                Log in to register a service
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
            {loginRequired ? (
                <LoginPrompt message="Log in to browse this registry" />
            ) : (
                <div className="rounded-xl border overflow-hidden">
                    <Table>
                        <ServicesTableHeader />
                        {loading === true ? (
                            <ServiceTableBodySkeleton />
                        ) : (
                            <ServicesTableBody
                                services={services}
                                fetchServices={fetchServices}
                            />
                        )}
                        <ServicesTableFooter />
                    </Table>
                </div>
            )}
        </div>
    );
}

export default Page;
