import { useCallback, useEffect, useState } from "react";
import { useCloudRegistry } from "./use-cloud-registry";

function useMe() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchMe = useCallback(() => {
        if (!cloudRegistryProvider) return;

        setLoading(true);
        setError(false);
        cloudRegistryProvider
            .getMe()
            .then((val) => setMe(val))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [cloudRegistryProvider]);

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    return { me, loading, error, refetch: fetchMe };
}

export { useMe };
