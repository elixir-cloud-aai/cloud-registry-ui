"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useCloudRegistry, useMe } from "@/hooks";
import { errorMessage } from "@/lib/errors";
import { canEditService, isUnauthorized } from "@/lib/permissions";
import ViewServiceDialogBody from "../../_components/view-service-dailog-body";

function Page() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [service, setService] = useState<ExternalService>();
    const { me } = useMe();
    const [loginRequired, setLoginRequired] = useState(false);

    useEffect(() => {
        if (!id) return;
        cloudRegistryProvider
            ?.getServiceById(decodeURIComponent(id as string))
            .then((_val) => setService(_val))
            .catch((err) => {
                if (isUnauthorized(err)) setLoginRequired(true);
                else
                    toast.error(
                        errorMessage(
                            err,
                            "Cannot fetch the service details. Please try again later.",
                        ),
                    );
            })
            .finally(() => setLoading(false));
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

    return (
        <Card className="w-full max-w-lg mx-auto mt-4 md:mt-10 gap-0 p-0">
            <CardHeader className="px-4 py-4 border-b">
                <CardTitle className="text-lg font-bold">
                    Artifact Details
                </CardTitle>
                <CardDescription>
                    Complete metadata for {service.id} deployment.
                </CardDescription>
            </CardHeader>
            <ViewServiceDialogBody service={service} />
            {canEditService(me, service.id) && (
                <CardFooter className="px-4 py-4 border-t justify-end">
                    <Button size="sm" asChild>
                        <Link
                            href={`/dashboard/services/update/${encodeURIComponent(service.id)}`}
                        >
                            Edit
                        </Link>
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}

export default Page;
