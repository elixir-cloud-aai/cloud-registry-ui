import { getCookie } from "cookies-next/client";
import { useCallback, useEffect, useState } from "react";
import { isAborted } from "@/lib/abort";
import type { Me } from "@/lib/cloud-registry.types";
import { isUnauthorized } from "@/lib/permissions";
import { useCloudRegistry } from "./use-cloud-registry";
import { useLatestRequest } from "./use-latest-request";

function useMe() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [expired, setExpired] = useState(false);
    // also aborted on unmount
    const latestRequest = useLatestRequest();

    const fetchMe = useCallback(() => {
        if (!cloudRegistryProvider) return;
        if (!getCookie("access_token")) {
            // logged out: there is nobody to fetch, and pending requests
            // must not restore the previous user
            latestRequest.abort();
            setMe(null);
            setLoading(false);
            return;
        }

        const signal = latestRequest.next();
        setLoading(true);
        setError(false);
        setExpired(false);
        cloudRegistryProvider
            .getCurrentUser({ signal })
            .then((val) => {
                if (!signal.aborted) setMe(val);
            })
            .catch((err) => {
                if (signal.aborted || isAborted(err)) return;
                // keep the user on transient errors, e.g. of a refetch
                if (isUnauthorized(err)) setMe(null);
                setError(true);
                setExpired(isUnauthorized(err));
            })
            .finally(() => {
                if (!signal.aborted) setLoading(false);
            });
    }, [cloudRegistryProvider, latestRequest]);

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    return { me, loading, error, expired, refetch: fetchMe };
}

export { useMe };
