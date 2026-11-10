import { useEffect, useState } from "react";
import { isAborted } from "@/lib/abort";
import { useCloudRegistry } from "./use-cloud-registry";
import { useLatestRequest } from "./use-latest-request";

/**
 * Whether a service is the registry's own entry (`serviceId` of `GET
 * /service-info/listing`), which the registry builds from its own service
 * info and never syncs. Only admins (in admin mode) can read the listing, so
 * it is read only if `enabled`; if it can't be read, the service is taken as
 * another one, as before the check (the registry refuses the sync then)
 * @param serviceId Service identifier, once known
 * @param enabled Whether to read the listing, e.g. for admins only
 * @returns `ownEntry`: whether it is the registry's own entry; `loading`:
 * the listing is read for this service and isn't known yet
 */
function useOwnEntry(serviceId: string | undefined, enabled: boolean) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [state, setState] = useState<{ id: string; own: boolean }>();
    // also aborted on unmount
    const latest = useLatestRequest();

    useEffect(() => {
        if (!enabled || !serviceId || !cloudRegistryProvider) return;
        const signal = latest.next();
        cloudRegistryProvider
            .getSelfListing({ signal })
            .then((listing) => {
                if (signal.aborted) return;
                setState({
                    id: serviceId,
                    own: listing.listed && listing.serviceId === serviceId,
                });
            })
            .catch((err) => {
                if (signal.aborted || isAborted(err)) return;
                console.error(
                    "Failed to load the listing of the registry:",
                    err,
                );
                setState({ id: serviceId, own: false });
            });
        return latest.abort;
    }, [enabled, serviceId, cloudRegistryProvider, latest]);

    if (!enabled || !serviceId) return { ownEntry: false, loading: false };
    const known = state?.id === serviceId;
    return { ownEntry: known && !!state?.own, loading: !known };
}

export { useOwnEntry };
