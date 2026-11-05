"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { LogIn, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { PageSubtitle } from "@/components/shared/page-subtitle";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import {
    useCloudRegistry,
    useLatestRequest,
    useMe,
    usePagination,
} from "@/hooks";
import { isAborted } from "@/lib/abort";
import { getApprovalsOrNull, withPendingServices } from "@/lib/approvals";
import type {
    ServiceSyncState,
    ServiceVerification,
} from "@/lib/cloud-registry.types";
import { errorMessage } from "@/lib/errors";
import { loginHref } from "@/lib/links";
import { hasStatus, isUnauthorized } from "@/lib/permissions";
import { syncedServices } from "@/lib/service-sync";
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
    myServices,
    type ServiceFilters,
} from "./_components/filter-helper";
import RegisterServiceDialog from "./_components/register-service-dialog";

const pageSize = 10;

function Page() {
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const { me, loading: meLoading, expired, refetch: refetchMe } = useMe();
    const [services, setServices] = useState<ExternalService[]>([]);
    const [verifications, setVerifications] = useState<ServiceVerification[]>(
        [],
    );
    const [syncStates, setSyncStates] = useState<ServiceSyncState[]>([]);
    const [pending, setPending] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [loginRequired, setLoginRequired] = useState(false);
    // also aborted on unmount
    const latestRequest = useLatestRequest();
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<ServiceFilters>(defaultFilters);
    const [registering, setRegistering] = useState(false);
    const searchParams = useSearchParams();

    // the user's services; without a user (e.g. after the session
    // expired), the filter for them is hidden, and doesn't apply
    const mine = myServices(me);
    const activeFilters = { ...filters, mine: !!me && filters.mine };
    const filtered = isFiltered(search, activeFilters);
    const verified = verifiedServices(services, verifications);
    const syncs = syncedServices(services, syncStates);
    const filteredServices = filterServices(services, search, activeFilters, {
        verifications: verified,
        pending,
        mine,
        syncs,
    });
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

    // one function per provider, so that the effect below loads the
    // services again only when the provider changes
    const fetchServices = useCallback(() => {
        if (!cloudRegistryProvider) return;
        const signal = latestRequest.next();
        Promise.all([
            cloudRegistryProvider.getServices({ signal }),
            cloudRegistryProvider.getVerifications({ signal }).catch((err) => {
                if (!isAborted(err))
                    console.error("Failed to load verifications:", err);
                return null;
            }),
            // pending services, for admins and users with a role on them
            getApprovalsOrNull(cloudRegistryProvider, { signal }),
            // none from registries that don't know syncs yet; on other
            // failures, the labels and the filter keep what they had
            cloudRegistryProvider.getSyncs({ signal }).catch((err) => {
                if (hasStatus(err, 404)) return [];
                if (!isAborted(err))
                    console.error("Failed to load the syncs:", err);
                return null;
            }),
        ])
            .then(([_val, verified, approvals, synced]) => {
                if (signal.aborted) return;
                setServices(withPendingServices(_val, approvals));
                setPending(
                    new Set(approvals?.services.map((val) => val.id) ?? []),
                );
                if (synced) setSyncStates(synced);
                else
                    toast.error(
                        "Could not load the syncs, so their labels may be out of date. Please try again later.",
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
                if (signal.aborted || isAborted(err)) return;
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
                if (!signal.aborted) setLoading(false);
            });
    }, [cloudRegistryProvider, latestRequest]);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    // links to the create form (`?register`, e.g. from
    // `/dashboard/services/create`) open it, also on this page, and leave
    // the plain URL
    useEffect(() => {
        if (!searchParams.has("register")) return;
        setRegistering(true);
        const url = new URL(window.location.href);
        url.searchParams.delete("register");
        window.history.replaceState(null, "", url);
    }, [searchParams]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
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
                <div className="flex flex-wrap gap-2 justify-end">
                    {isLoggedIn && !expired && (
                        <Button onClick={() => setRegistering(true)}>
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
                        showMine={!!me}
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
                                    syncs={syncs}
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
            <RegisterServiceDialog
                open={registering}
                onOpenChange={setRegistering}
                onRegistered={() => {
                    fetchServices();
                    // the user's services, e.g. for the services limit
                    refetchMe();
                }}
            />
        </div>
    );
}

export default Page;
