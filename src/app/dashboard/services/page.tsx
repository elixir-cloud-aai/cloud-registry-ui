"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { LogIn, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { PageSubtitle } from "@/components/shared/page-subtitle";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { useCloudRegistry, useMe, usePagination } from "@/hooks";
import { getApprovalsOrNull, withPendingServices } from "@/lib/approvals";
import type { ServiceVerification } from "@/lib/cloud-registry.types";
import { errorMessage } from "@/lib/errors";
import { loginHref } from "@/lib/links";
import { isUnauthorized } from "@/lib/permissions";
import { verifiedServices } from "@/lib/verifications";
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
    const { me, loading: meLoading, expired, refetch: refetchMe } = useMe();
    const [services, setServices] = useState<ExternalService[]>([]);
    const [verifications, setVerifications] = useState<ServiceVerification[]>(
        [],
    );
    const [pending, setPending] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [loginRequired, setLoginRequired] = useState(false);
    const latestRequest = useRef(0);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<ServiceFilters>(defaultFilters);

    const filtered = isFiltered(search, filters);
    const verified = verifiedServices(services, verifications);
    const filteredServices = filterServices(
        services,
        search,
        filters,
        verified,
        pending,
    );
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
        if (!cloudRegistryProvider) return;
        const request = ++latestRequest.current;
        Promise.all([
            cloudRegistryProvider.getServices(),
            cloudRegistryProvider.getVerifications().catch((err) => {
                console.error("Failed to load verifications:", err);
                return null;
            }),
            // pending services, for admins and users with a role on them
            getApprovalsOrNull(cloudRegistryProvider),
        ])
            .then(([_val, verified, approvals]) => {
                if (request !== latestRequest.current) return;
                setServices(withPendingServices(_val, approvals));
                setPending(
                    new Set(approvals?.services.map((val) => val.id) ?? []),
                );
                if (verified) setVerifications(verified);
                else
                    toast.error(
                        "Could not load the verifications. Please try again later.",
                    );
                if (!approvals)
                    toast.error(
                        "Could not load the pending services. Please try again later.",
                    );
            })
            .catch((err) => {
                if (request !== latestRequest.current) return;
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
                if (request === latestRequest.current) setLoading(false);
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
                    <PageSubtitle
                        me={me}
                        loading={meLoading}
                        guest="View our registered services"
                        user="View our registered services and manage your own"
                        admin="View and manage all services"
                    />
                </div>
                <div className="hidden md:flex flex-wrap gap-2 justify-end">
                    {isLoggedIn && !expired && (
                        <Button
                            onClick={() =>
                                router.push("/dashboard/services/create")
                            }
                        >
                            <PlusIcon />
                            Register Service
                        </Button>
                    )}
                    {isLoggedIn && expired && (
                        <Button variant={"outline"} asChild>
                            <Link href={loginHref("/dashboard/services")}>
                                <LogIn />
                                Log in again
                            </Link>
                        </Button>
                    )}
                    {!isLoggedIn && (
                        <p className="text-sm text-muted-foreground">
                            Log in above to register a service
                        </p>
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
                        showPending={!!me?.admin}
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
                                    verifications={verified}
                                    pending={pending}
                                    fetchServices={fetchServices}
                                    refetchMe={refetchMe}
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
