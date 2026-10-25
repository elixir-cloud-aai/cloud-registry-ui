"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { ManageAccessDialog } from "@/components/shared/manage-access";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useCloudRegistry, useMe, useServiceVerification } from "@/hooks";
import { errorMessage } from "@/lib/errors";
import {
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
    const verification = useServiceVerification(service);
    const { me, refetch } = useMe();
    const [loginRequired, setLoginRequired] = useState(false);
    const [manageOpen, setManageOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        // responses for a previous ID must not replace the service
        let current = true;
        setService(undefined);
        setManageOpen(false);
        setLoading(true);
        cloudRegistryProvider
            ?.getServiceById(decodeURIComponent(id as string))
            .then((_val) => {
                if (current) setService(_val);
            })
            .catch((err) => {
                if (!current) return;
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
                if (current) setLoading(false);
            });
        return () => {
            current = false;
        };
    }, [cloudRegistryProvider, id]);

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

    return (
        <Card className="w-full max-w-lg mx-auto mt-4 md:mt-10 gap-0 p-0">
            <CardHeader className="px-4 py-4 border-b">
                <CardTitle className="text-lg font-bold">
                    Artifact Details
                </CardTitle>
                <CardDescription>
                    Complete metadata for {service.id} deployment.
                </CardDescription>
                {verification && <VerifiedBadge />}
            </CardHeader>
            <ViewServiceDialogBody
                service={service}
                verification={verification}
            />
            {canEditService(me, service.id) && (
                <CardFooter className="px-4 py-4 border-t justify-end gap-2">
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
                    <Button size="sm" asChild>
                        <Link
                            href={`/dashboard/services/update/${encodeURIComponent(service.id)}`}
                        >
                            Edit
                        </Link>
                    </Button>
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
