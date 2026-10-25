import { getCookie } from "cookies-next/client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/cloud-registry.types";
import { useCloudRegistry } from "./use-cloud-registry";

function useMe() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const latestRequest = useRef(0);

    const fetchMe = useCallback(() => {
        if (!cloudRegistryProvider) return;
        if (!getCookie("access_token")) {
            // logged out: there is nobody to fetch, and pending requests
            // must not restore the previous user
            latestRequest.current++;
            setMe(null);
            setLoading(false);
            return;
        }

        const request = ++latestRequest.current;
        setLoading(true);
        setError(false);
        cloudRegistryProvider
            .getCurrentUser()
            .then((val) => {
                if (request === latestRequest.current) setMe(val);
            })
            .catch(() => {
                if (request !== latestRequest.current) return;
                setMe(null);
                setError(true);
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false);
            });
    }, [cloudRegistryProvider]);

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    return { me, loading, error, refetch: fetchMe };
}

export { useMe };
