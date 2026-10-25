"use client";
import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ListPagination } from "@/components/shared/list-pagination";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { PageSubtitle } from "@/components/shared/page-subtitle";
import { useCloudRegistry, useMe, usePagination } from "@/hooks";
import { errorMessage, mutationError } from "@/lib/errors";
import { isUnauthorized } from "@/lib/permissions";
import { typeKey, typeLabel } from "@/lib/service-types";
import { ServiceTypeAddDialog, ServiceTypeCard } from "./_components";

const pageSize = 12;

function Page() {
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [serviceTypes, setServiceTypes] = useState<ServiceType[] | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [loginRequired, setLoginRequired] = useState(false);
    const [removing, setRemoving] = useState(false);
    const latestRequest = useRef(0);
    const removingRef = useRef(false);
    const { me, loading: meLoading } = useMe();
    const { page, pageCount, pageItems, setPage } = usePagination(
        serviceTypes ?? [],
        pageSize,
    );

    const fetchServiceTypes = useCallback(() => {
        if (!cloudRegistryProvider) return Promise.resolve();
        // responses of earlier requests must not replace the list
        const request = ++latestRequest.current;
        return cloudRegistryProvider
            .getServiceTypes()
            .then((val) => {
                if (request === latestRequest.current) setServiceTypes(val);
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
                </div>
                {me?.may_add_service_types && (
                    <ServiceTypeAddDialog
                        provider={cloudRegistryProvider}
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
                                disabled={removing}
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
