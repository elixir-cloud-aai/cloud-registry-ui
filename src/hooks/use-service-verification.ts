import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Verification } from "@/lib/cloud-registry.types";
import { errorMessage } from "@/lib/errors";
import { hasStatus } from "@/lib/permissions";
import { matchesVerification } from "@/lib/verifications";
import { useCloudRegistry } from "./use-cloud-registry";

export function useServiceVerification(service?: ExternalService) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [state, setState] = useState<{
        service: ExternalService;
        verification?: Verification;
    }>();

    useEffect(() => {
        if (!service) return;
        let current = true;
        cloudRegistryProvider
            ?.getServiceVerification(service.id)
            .then((val) => {
                if (!current) return;
                setState({
                    service,
                    verification: matchesVerification(service, val)
                        ? val
                        : undefined,
                });
            })
            .catch((err) => {
                if (!current) return;
                setState({ service });
                if (hasStatus(err, 404)) return;
                toast.error(
                    errorMessage(
                        err,
                        "Could not load the verification. Please try again later.",
                    ),
                );
            });
        return () => {
            current = false;
        };
    }, [cloudRegistryProvider, service]);

    return state?.service === service ? state?.verification : undefined;
}
