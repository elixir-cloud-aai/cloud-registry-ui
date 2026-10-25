"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApproveTypeButton } from "@/components/shared/approve-type";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { ManageAccessDialog } from "@/components/shared/manage-access";
import { PendingBadge, PendingBanner } from "@/components/shared/pending";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useCloudRegistry, useMe, useServiceVerification } from "@/hooks";
import { getServiceWithApproval } from "@/lib/approvals";
import { errorMessage } from "@/lib/errors";
import {
    canApproveServiceType,
    canDeleteService,
    canEditService,
    canManageAccess,
    isUnauthorized,
} from "@/lib/permissions";
import { VerifiedBadge } from "../../_components";
import ViewServiceDialogBody from "../../_components/view-service-dailog-body";

function Page() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [service, setService] = useState<ExternalService>();
    // undefined if unknown, see getServiceWithApproval
    const [pending, setPending] = useState<boolean>();
    const verification = useServiceVerification(service);
    const { me, refetch } = useMe();
    const [loginRequired, setLoginRequired] = useState(false);
    const [manageOpen, setManageOpen] = useState(false);
    const latestRequest = useRef(0);

    // pending services are only listed in GET /approvals
    const fetchService = useCallback(() => {
        if (!id || !cloudRegistryProvider) return;
        // responses of earlier requests, e.g. for a previous ID, must not
        // replace the service
        const request = ++latestRequest.current;
        getServiceWithApproval(
            cloudRegistryProvider,
            decodeURIComponent(id as string),
        )
            .then((_val) => {
                if (request !== latestRequest.current) return;
                setService(_val.service);
                setPending(_val.pending);
                if (_val.pending === undefined)
                    toast.error(
                        "Could not check whether this service awaits approval. Please try again later.",
                    );
            })
            .catch((err) => {
                if (request !== latestRequest.current) return;
                if (isUnauthorized(err)) setLoginRequired(true);
                else
                    toast.error(
                        errorMessage(
                            err,
                            "Cannot fetch the service details. Please try again later.",
                        ),
                    );
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false);
            });
    }, [cloudRegistryProvider, id]);

    useEffect(() => {
        setService(undefined);
        setPending(undefined);
        setManageOpen(false);
        setLoading(true);
        fetchService();
        // e.g. for a previous ID
        return () => {
            latestRequest.current++;
        };
    }, [fetchService]);

    if (loginRequired)
        return (
            <LoginPrompt
                message={
                    isLoggedIn
                        ? "Your session expired. Please log in again."
                        : "Log in to browse this registry"
                }
            />
        );

    if (loading)
        return (
            <p className="font-bold text-lg mt-20 text-center w-full">
                Loading...
            </p>
        );

    if (!service)
        return (
            <div className="w-full flex justify-center items-center h-full">
                <p>No service data found. Please try again later.</p>
            </div>
        );

    const manageAccess = canManageAccess(me, service.id);
    const canEdit = canEditService(me, service.id);
    const canApprove = pending && canApproveServiceType(me);

    return (
        <Card className="w-full max-w-lg mx-auto mt-4 md:mt-10 gap-0 p-0">
            <CardHeader className="px-4 py-4 border-b">
                <CardTitle className="text-lg font-bold">
                    Artifact Details
                </CardTitle>
                <CardDescription>
                    Complete metadata for {service.id} deployment.
                </CardDescription>
                {(verification || pending) && (
                    <div className="flex gap-2">
                        {verification && <VerifiedBadge />}
                        {pending && <PendingBadge />}
                    </div>
                )}
            </CardHeader>
            {pending && (
                <div className="px-6 pt-5">
                    <PendingBanner
                        serviceType={service.type}
                        admin={me?.admin}
                        canEdit={canEdit}
                        canDelete={canDeleteService(me, service.id)}
                    />
                </div>
            )}
            <ViewServiceDialogBody
                service={service}
                verification={verification}
            />
            {(canEdit || manageAccess || canApprove) && (
                <CardFooter className="px-4 py-4 border-t justify-end gap-2">
                    {canApprove && (
                        <ApproveTypeButton
                            serviceType={service.type}
                            provider={cloudRegistryProvider}
                            onApproved={fetchService}
                        />
                    )}
                    {manageAccess && (
                        <Button
                            size="sm"
                            variant={"outline"}
                            onClick={() => setManageOpen(true)}
                        >
                            <KeyRound />
                            Manage access
                        </Button>
                    )}
                    {canEdit && (
                        <Button size="sm" asChild>
                            <Link
                                href={`/dashboard/services/update/${encodeURIComponent(service.id)}`}
                            >
                                Edit
                            </Link>
                        </Button>
                    )}
                </CardFooter>
            )}
            {manageAccess && manageOpen && (
                <ManageAccessDialog
                    provider={cloudRegistryProvider}
                    serviceId={service.id}
                    currentUserId={me?.user_id}
                    open={manageOpen}
                    onOpenChange={setManageOpen}
                    onChange={refetch}
                />
            )}
        </Card>
    );
}

export default Page;
