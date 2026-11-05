import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ServiceSync } from "@/lib/cloud-registry.types";
import { errorMessage } from "@/lib/errors";
import { hasStatus, isUnauthorized } from "@/lib/permissions";
import { useCloudRegistry } from "./use-cloud-registry";

/**
 * The state of a service's sync with its service info
 * @param serviceId Service identifier, once known
 * @returns `sync`: the state; undefined without sync (the registry answers
 * `404`, also if the deployment doesn't sync) and until `loaded`; `failed`:
 * the state is unknown, which isn't the same as no sync; `setSync`: take a
 * state that the registry returned; `reload`: read it again
 */
function useServiceSync(serviceId?: string) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [state, setState] = useState<{
        id: string;
        sync?: ServiceSync;
        failed?: boolean;
    }>();
    const latest = useRef(0);

    const reload = useCallback(() => {
        if (!serviceId || !cloudRegistryProvider) return;
        const request = ++latest.current;
        cloudRegistryProvider
            .getServiceSync(serviceId)
            .then((sync) => {
                if (request === latest.current)
                    setState({ id: serviceId, sync });
            })
            .catch((err) => {
                if (request !== latest.current) return;
                const failed = !hasStatus(err, 404);
                setState({ id: serviceId, failed });
                // an expired login has its own message on the page
                if (!failed || isUnauthorized(err)) return;
                toast.error(
                    errorMessage(
                        err,
                        "Could not load the sync of this service. Please try again later.",
                    ),
                );
            });
    }, [cloudRegistryProvider, serviceId]);

    useEffect(() => {
        reload();
        return () => {
            latest.current++;
        };
    }, [reload]);

    const setSync = useCallback(
        (sync?: ServiceSync) => {
            latest.current++;
            if (serviceId) setState({ id: serviceId, sync });
        },
        [serviceId],
    );

    const loaded = !!serviceId && state?.id === serviceId;
    return {
        sync: loaded ? state?.sync : undefined,
        loaded,
        failed: loaded && !!state?.failed,
        setSync,
        reload,
    };
}

export { useServiceSync };
