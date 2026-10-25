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
import { useCloudRegistry, useMe, usePagination } from "@/hooks";
import { errorMessage } from "@/lib/errors";
import { isUnauthorized } from "@/lib/permissions";
import {
    ServicesTableBody,
    ServicesTableFilters,
    ServicesTableFooter,
    ServicesTableHeader,
    ServiceTableBodySkeleton,
} from "./_components";
import {
    defaultFilters,
    filterServices,
    isFiltered,
    type ServiceFilters,
} from "./_components/filter-helper";

const pageSize = 10;

function Page() {
    const router = useRouter();
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const { me, expired } = useMe();
    const [services, setServices] = useState<ExternalService[]>([]);
    const [loading, setLoading] = useState(true);
    const [loginRequired, setLoginRequired] = useState(false);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<ServiceFilters>(defaultFilters);

    const filtered = isFiltered(search, filters);
    const filteredServices = filterServices(services, search, filters);
    const { page, pageCount, pageItems, start, end, setPage } = usePagination(
        filteredServices,
        pageSize,
    );

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(1);
    };

    const handleFiltersChange = (value: ServiceFilters) => {
        setFilters(value);
        setPage(1);
    };

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
                    errorMessage(
                        err,
                        "We are having trouble loading services. Please refresh or try again later.",
                    ),
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
                    {isLoggedIn && !expired ? (
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
                <LoginPrompt
                    message={
                        isLoggedIn
                            ? "Your session expired. Please log in again."
                            : "Log in to browse this registry"
                    }
                />
            ) : (
                <div className="space-y-4">
                    <ServicesTableFilters
                        services={services}
                        search={search}
                        filters={filters}
                        filtered={filtered}
                        disabled={loading || services.length === 0}
                        onSearchChange={handleSearchChange}
                        onFiltersChange={handleFiltersChange}
                    />
                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <ServicesTableHeader />
                            {loading === true ? (
                                <ServiceTableBodySkeleton />
                            ) : (
                                <ServicesTableBody
                                    services={pageItems}
                                    fetchServices={fetchServices}
                                    me={me}
                                    emptyMessage={
                                        filtered
                                            ? "No services match your search or filters."
                                            : undefined
                                    }
                                />
                            )}
                            <ServicesTableFooter
                                total={loading ? 0 : filteredServices.length}
                                start={start}
                                end={end}
                                page={page}
                                pageCount={pageCount}
                                onPageChange={setPage}
                            />
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Page;
