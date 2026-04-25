import { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { getAccessToken } from "@/lib/get-access-token";
import { useEffect, useState } from "react";


function useCloudRegistry() {
    const [cloudRegistryProvider, setCloudRegistryProvider] = useState<AuthenticatedCloudRegistryProvider | null>(null);
    const [token, setToken] = useState("");

    useEffect(() => {
        getAccessToken().then((token) => {
            setToken(token as string);
        });
    }, []);

    useEffect(() => {
        if (!token) return;

        const provider = new AuthenticatedCloudRegistryProvider(
            process.env.NEXT_PUBLIC_CLOUD_REGISTRY_URL || "",
            token as string,
        );
        setCloudRegistryProvider(provider);
    }, [token]);

    return {
        cloudRegistryProvider,
    };
}

export { useCloudRegistry };

