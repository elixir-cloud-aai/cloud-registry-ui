"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useCloudRegistry, useMe, useServiceVerification } from "@/hooks";
import { getServiceWithApproval } from "@/lib/approvals";
import { errorMessage } from "@/lib/errors";
import { hasStatus, isUnauthorized } from "@/lib/permissions";
import ServiceDetails from "../../_components/service-details";

function Page() {
    const { id } = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [service, setService] = useState<ExternalService>();
    // undefined if unknown, see getServiceWithApproval
    const [pending, setPending] = useState<boolean>();
    const verification = useServiceVerification(service);
    const { me, refetch } = useMe();
    const [loginRequired, setLoginRequired] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const latestRequest = useRef(0);
    // warn once per service that its approval couldn't be checked, not
    // after every change
    const warnedPending = useRef(false);

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
                setNotFound(false);
                if (_val.pending === undefined && !warnedPending.current) {
                    warnedPending.current = true;
                    toast.error(
                        "Could not check whether this service awaits approval. Please try again later.",
                    );
                }
            })
            .catch((err) => {
                if (request !== latestRequest.current) return;
                if (isUnauthorized(err)) setLoginRequired(true);
                // also services that the user may not see, e.g. pending
                // ones for guests
                else if (hasStatus(err, 404)) {
                    // e.g. after it was deleted
                    setService(undefined);
                    setNotFound(true);
                } else
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
        setNotFound(false);
        setLoading(true);
        warnedPending.current = false;
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

    if (notFound)
        return (
            <div className="w-full flex flex-col gap-4 items-center mt-20 text-center">
                <p className="font-bold text-lg">Service not found</p>
                <p className="text-sm text-muted-foreground max-w-md">
                    {isLoggedIn
                        ? "This service doesn't exist, or you may not see it, e.g. while it awaits approval."
                        : "This service doesn't exist, or it awaits approval. Log in if you added it or have a role on it."}
                </p>
                <Button size="sm" variant={"outline"} asChild>
                    <Link href="/dashboard/services">Back to services</Link>
                </Button>
            </div>
        );

    if (!service)
        return (
            <div className="w-full flex justify-center items-center h-full">
                <p>No service data found. Please try again later.</p>
            </div>
        );

    return (
        <Card className="w-full max-w-lg mx-auto mt-4 md:mt-10 gap-0 p-0">
            <ServiceDetails
                service={service}
                verification={verification}
                pending={pending}
                cloudRegistryProvider={cloudRegistryProvider}
                me={me}
                Title={CardTitle}
                Description={CardDescription}
                onChange={fetchService}
                onAccessChange={() => {
                    fetchService();
                    refetch();
                }}
                onDeleted={() => router.push("/dashboard/services")}
            />
        </Card>
    );
}

export default Page;
