"use client";
import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { ClockIcon, LogIn } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ListPagination } from "@/components/shared/list-pagination";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { PageSubtitle } from "@/components/shared/page-subtitle";
import { Button } from "@/components/ui/button";
import { useCloudRegistry, useMe, usePagination } from "@/hooks";
import { getApprovalsOrNull, withPendingTypes } from "@/lib/approvals";
import { errorMessage, mutationError } from "@/lib/errors";
import { loginHref } from "@/lib/links";
import { canApproveServiceType, isUnauthorized } from "@/lib/permissions";
import { typeKey, typeLabel } from "@/lib/service-types";
import { ServiceTypeAddDialog, ServiceTypeCard } from "./_components";

const pageSize = 12;

function Page() {
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [serviceTypes, setServiceTypes] = useState<ServiceType[] | null>(
        null,
    );
    const [pending, setPending] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [loginRequired, setLoginRequired] = useState(false);
    const [removing, setRemoving] = useState(false);
    const latestRequest = useRef(0);
    const removingRef = useRef(false);
    const { me, loading: meLoading, expired } = useMe();
    const { page, pageCount, pageItems, setPage } = usePagination(
        serviceTypes ?? [],
        pageSize,
    );

    const fetchServiceTypes = useCallback(() => {
        if (!cloudRegistryProvider) return Promise.resolve();
        // responses of earlier requests must not replace the list
        const request = ++latestRequest.current;
        return Promise.all([
            cloudRegistryProvider.getServiceTypes(),
            // pending types, for admins and the users who added them
            getApprovalsOrNull(cloudRegistryProvider),
        ])
            .then(([val, approvals]) => {
                if (request !== latestRequest.current) return;
                setServiceTypes(withPendingTypes(val, approvals));
                setPending(
                    new Set(approvals?.service_types.map(typeKey) ?? []),
                );
                if (!approvals)
                    toast.error(
                        "Could not load the pending service types. Please try again later.",
                    );
            })
            .catch((err) => {
                if (request !== latestRequest.current) return;
                if (isUnauthorized(err)) setLoginRequired(true);
                else
                    toast.error(
                        errorMessage(err, "Could not fetch the service types."),
                    );
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false);
            });
    }, [cloudRegistryProvider]);

    useEffect(() => {
        fetchServiceTypes();
        return () => {
            latestRequest.current++;
        };
    }, [fetchServiceTypes]);

    const handleRemove = async (serviceType: ServiceType) => {
        // one removal at a time, also on double clicks
        if (!cloudRegistryProvider || removingRef.current) return;
        removingRef.current = true;
        setRemoving(true);

        const promise = cloudRegistryProvider.removeServiceType(serviceType);

        toast.promise(promise, {
            loading: `Removing service type ${typeLabel(serviceType)}`,
            success: `Removed service type ${typeLabel(serviceType)}`,
            error: (err) =>
                mutationError(
                    err,
                    "Cannot remove the service type currently.",
                    "Only admins can remove service types.",
                ),
        });

        try {
            await promise;
        } catch {
            // toast.promise shows the error
        } finally {
            // also after errors, e.g. if another admin removed the type
            await fetchServiceTypes();
            removingRef.current = false;
            setRemoving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-semibold tracking-tight mt-2">
                        Service Types
                    </h2>
                    <PageSubtitle
                        me={me}
                        loading={meLoading}
                        guest="View our registered service types"
                        user={
                            me?.may_add_service_types
                                ? "View our registered service types and add your own"
                                : undefined
                        }
                        admin="View and manage all service types"
                    />
                    {me?.may_add_service_types && me.service_types_pending && (
                        <p className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <ClockIcon className="size-4 shrink-0" />
                            New service types are pending until an admin
                            approves them.
                        </p>
                    )}
                    {isLoggedIn && expired && (
                        <p className="mt-2 text-sm text-muted-foreground">
                            Your session expired: log in again to see your
                            pending service types.
                        </p>
                    )}
                </div>
                {isLoggedIn && expired && (
                    <Button variant={"outline"} asChild>
                        <Link href={loginHref("/dashboard/service-types")}>
                            <LogIn />
                            Log in again
                        </Link>
                    </Button>
                )}
                {me?.may_add_service_types && (
                    <ServiceTypeAddDialog
                        provider={cloudRegistryProvider}
                        pending={me.service_types_pending}
                        onAdded={fetchServiceTypes}
                    />
                )}
            </div>
            <div>
                <div className="flex gap-4 flex-wrap justify-center md:justify-start">
                    {loading === true && (
                        <p className="font-bold text-lg mt-20 text-center w-full">
                            Loading...
                        </p>
                    )}
                    {serviceTypes !== null &&
                        pageItems.map((val) => (
                            <ServiceTypeCard
                                key={typeKey(val)}
                                serviceType={val}
                                pending={pending.has(typeKey(val))}
                                disabled={removing}
                                canApprove={canApproveServiceType(me)}
                                provider={cloudRegistryProvider}
                                onApproved={fetchServiceTypes}
                                onRemove={
                                    me?.admin
                                        ? () => handleRemove(val)
                                        : undefined
                                }
                            />
                        ))}
                    {loginRequired && (
                        <LoginPrompt
                            message={
                                isLoggedIn
                                    ? "Your session expired. Please log in again."
                                    : "Log in to browse this registry"
                            }
                        />
                    )}
                    {loading === false &&
                        !loginRequired &&
                        !serviceTypes?.length && (
                            <p className="font-bold text-lg mt-20 text-center w-full">
                                No service types
                            </p>
                        )}
                </div>
                <ListPagination
                    page={page}
                    pageCount={pageCount}
                    onPageChange={setPage}
                    className="mt-6"
                />
            </div>
        </div>
    );
}

export default Page;
