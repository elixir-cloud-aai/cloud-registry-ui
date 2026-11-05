import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Verification } from "@/lib/cloud-registry.types";
import { errorMessage } from "@/lib/errors";
import { hasStatus } from "@/lib/permissions";
import { matchesVerification } from "@/lib/verifications";
import { useCloudRegistry } from "./use-cloud-registry";

/**
 * Verification of a service, and whether it has loaded: until then,
 * verification is undefined as for unverified services
 */
export function useServiceVerification(service?: ExternalService) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [state, setState] = useState<{
        service: ExternalService;
        verification?: Verification;
    }>();

    useEffect(() => {
        if (!service) return;
        // aborted on unmount and when the service changes
        const controller = new AbortController();
        const { signal } = controller;
        cloudRegistryProvider
            ?.getServiceVerification(service.id, { signal })
            .then((val) => {
                if (signal.aborted) return;
                setState({
                    service,
                    verification: matchesVerification(service, val)
                        ? val
                        : undefined,
                });
            })
            .catch((err) => {
                if (signal.aborted) return;
                setState({ service });
                if (hasStatus(err, 404)) return;
                toast.error(
                    errorMessage(
                        err,
                        "Could not load the verification. Please try again later.",
                    ),
                );
            });
        return () => controller.abort();
    }, [cloudRegistryProvider, service]);

    const loaded = !!service && state?.service === service;
    return {
        verification: loaded ? state?.verification : undefined,
        loaded,
    };
}
